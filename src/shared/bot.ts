import { BOARD, GROUP_MEMBERS, JAIL_FINE, isOwnable, unmortgageCost } from './board';
import {
  activePlayer,
  canBuild,
  canMortgage,
  canSell,
  canUnmortgage,
  debtsOf,
  getPlayer,
  propertiesOf,
  rentFor,
  sameTeam,
  validateTrade,
} from './engine';
import type { Action, BotLevel, GameState, Player, TradeDraft, TradeOffer } from './types';

const RESERVE: Record<BotLevel, number> = { easy: 60, normal: 150, hard: 200 };

const unownedCount = (s: GameState) => s.ownership.filter((o, i) => isOwnable(i) && !o.owner).length;

/** Highest rent the player could realistically be asked to pay next turn. */
function dangerLevel(s: GameState, me: Player): number {
  let worst = 0;
  for (let step = 2; step <= 12; step++) {
    const i = (me.position + step) % 40;
    const own = s.ownership[i];
    if (own.owner && !sameTeam(s, own.owner, me.id)) worst = Math.max(worst, rentFor(s, i, 7));
  }
  return worst;
}

function reserveFor(s: GameState, me: Player): number {
  const level = me.botLevel ?? 'normal';
  const base = RESERVE[level];
  return level === 'hard' ? Math.max(base, Math.min(600, dangerLevel(s, me))) : base;
}

/** How much a space is worth to `who` (with set-completion and blocking bonuses). */
export function valueFor(s: GameState, who: string, index: number, removing = false): number {
  const sp = BOARD[index];
  const price = sp.price ?? 0;
  const members = GROUP_MEMBERS[sp.group!];
  const mine = members.filter((i) => i !== index && sameTeam(s, s.ownership[i].owner, who)).length;
  const others = members.filter((i) => i !== index && s.ownership[i].owner && !sameTeam(s, s.ownership[i].owner, who));
  const total = members.length;
  let v = price;
  if (sp.type === 'property') {
    if (mine === total - 1) v *= removing ? 2.2 : 2.6; // completes (or breaks) a set
    else if (mine > 0) v *= 1.3;
    const blocker = new Set(others.map((i) => s.ownership[i].owner)).size === 1 && others.length === total - 1;
    if (blocker) v *= 1.5; // keeping it blocks an opponent's set
  } else if (sp.type === 'airport') {
    v *= 1 + mine * 0.35;
  } else {
    v *= mine ? 1.5 : 1;
  }
  return Math.round(v);
}

function wantsToBuy(s: GameState, me: Player, index: number): boolean {
  const sp = BOARD[index];
  const price = sp.price!;
  if (me.cash < price) return false;
  const level = me.botLevel ?? 'normal';
  const reserve = reserveFor(s, me);
  const value = valueFor(s, me.id, index);
  if (value > price * 1.4) return me.cash - price >= reserve / 3; // important for sets
  return me.cash - price >= (level === 'easy' ? reserve / 2 : reserve);
}

function maxBid(s: GameState, me: Player, index: number): number {
  const level = me.botLevel ?? 'normal';
  const value = valueFor(s, me.id, index);
  const factor = level === 'easy' ? 0.8 : level === 'normal' ? 1 : 1.15;
  const limit = me.cash - reserveFor(s, me) / 2;
  return Math.max(0, Math.min(Math.round(value * factor), limit));
}

/** Pick one step to raise cash: sell a building, otherwise mortgage the least valuable property. */
function raiseCashStep(s: GameState, me: Player): Action | null {
  const props = propertiesOf(s, me.id);
  const sellable = props.filter((i) => !canSell(s, me.id, i));
  if (sellable.length) {
    sellable.sort((a, b) => (BOARD[a].houseCost ?? 0) - (BOARD[b].houseCost ?? 0));
    return { type: 'sell', space: sellable[0] };
  }
  const mortgageable = props.filter((i) => !canMortgage(s, me.id, i));
  if (mortgageable.length) {
    mortgageable.sort((a, b) => valueFor(s, me.id, a, true) - valueFor(s, me.id, b, true));
    return { type: 'mortgage', space: mortgageable[0] };
  }
  return null;
}

function resolveDebts(s: GameState, me: Player): Action | null {
  const debts = debtsOf(s, me.id);
  if (!debts.length) return null;
  if (me.cash >= debts[0].amount) return { type: 'payDebt' };
  return raiseCashStep(s, me) ?? { type: 'bankrupt' };
}

/** Would `who` own the whole group of `index` after receiving `incoming`? */
function completesSet(s: GameState, who: string, index: number, incoming: number[]): boolean {
  const sp = BOARD[index];
  if (sp.type !== 'property') return false;
  return GROUP_MEMBERS[sp.group!].every((m) => sameTeam(s, s.ownership[m].owner, who) || incoming.includes(m));
}

export function evaluateTrade(s: GameState, me: Player, t: TradeOffer | (TradeDraft & { from: string })): number {
  const level = me.botLevel ?? 'normal';
  const teammate = t.from !== me.id && sameTeam(s, t.from, me.id);
  let gain = t.giveCash - t.getCash + (t.giveCards - t.getCards) * 40;
  for (const i of t.giveProps) gain += valueFor(s, me.id, i);
  const iGetASet = t.giveProps.some((i) => completesSet(s, me.id, i, t.giveProps));
  for (const i of t.getProps) {
    gain -= valueFor(s, me.id, i, true);
    // Handing an opponent a full set is dangerous, unless we get one too. For a teammate it's a win.
    if (completesSet(s, t.from, i, t.getProps)) {
      if (teammate) gain += (BOARD[i].price ?? 0) * 1.2;
      else gain -= (BOARD[i].price ?? 0) * (iGetASet ? 0.3 : 1.5);
    }
  }
  // Long stalemates make everybody more willing to deal.
  const patience = Math.min(1, s.round / 60);
  const margin = teammate ? 0 : (level === 'easy' ? 0 : level === 'normal' ? 30 : 80) * (1 - patience);
  return gain - margin + patience * 120;
}

const lastProposal = new Map<string, number>();

/** Try to complete a color set via a swap (both sides get a set) or a cash offer. */
function proposeSetTrade(s: GameState, me: Player): Action | null {
  if ((me.botLevel ?? 'normal') === 'easy' && s.round < 25) return null;
  if (s.trades.some((t) => t.from === me.id)) return null;
  const reserve = reserveFor(s, me);
  const mine = propertiesOf(s, me.id);
  for (const members of Object.values(GROUP_MEMBERS)) {
    if (BOARD[members[0]].type !== 'property') continue;
    const missing = members.filter((i) => !sameTeam(s, s.ownership[i].owner, me.id));
    if (missing.length !== 1 || missing.length === members.length) continue;
    const target = missing[0];
    const owner = s.ownership[target].owner;
    if (!owner || s.ownership[target].houses || s.ownership[target].owner === me.id) continue;
    const other = getPlayer(s, owner)!;
    const key = `${s.id}:${me.id}:${target}`;
    const cooldown = other.isBot ? 3 : 8;
    if (s.round - (lastProposal.get(key) ?? -99) < cooldown) continue;

    const accepts = (draft: TradeDraft) =>
      !validateTrade(s, me.id, draft) && (!other.isBot || evaluateTrade(s, other, { ...draft, from: me.id }) > 0);

    // 1) A swap that hands them a set as well.
    for (const h of mine) {
      if (members.includes(h) || !completesSet(s, other.id, h, [h])) continue;
      if (s.ownership[h].houses || GROUP_MEMBERS[BOARD[h].group!].some((m) => s.ownership[m].houses)) continue;
      const diff = (BOARD[target].price ?? 0) - (BOARD[h].price ?? 0);
      const draft: TradeDraft = {
        to: other.id, giveProps: [h], getProps: [target],
        giveCash: Math.max(0, Math.min(diff + 50, me.cash - reserve)), getCash: diff < -50 ? Math.min(-diff - 50, other.cash) : 0,
        giveCards: 0, getCards: 0,
      };
      if (accepts(draft)) {
        lastProposal.set(key, s.round);
        return { type: 'proposeTrade', offer: draft };
      }
    }

    // 2) A cash offer that grows with the length of the game.
    const price = BOARD[target].price!;
    const mult = 1.6 + Math.min(1.6, s.round / 25);
    const offer = Math.min(Math.round(price * mult + 40), me.cash - reserve);
    if (offer < price) continue;
    const draft: TradeDraft = { to: other.id, giveProps: [], getProps: [target], giveCash: offer, getCash: 0, giveCards: 0, getCards: 0 };
    lastProposal.set(key, s.round);
    if (accepts(draft)) return { type: 'proposeTrade', offer: draft };
  }
  return null;
}

function improve(s: GameState, me: Player): Action | null {
  const reserve = reserveFor(s, me);
  const props = propertiesOf(s, me.id);
  // Unmortgage set members first when comfortably rich.
  const mortgaged = props
    .filter((i) => !canUnmortgage(s, me.id, i) && me.cash - unmortgageCost(i) > reserve * 2)
    .sort((a, b) => valueFor(s, me.id, b) - valueFor(s, me.id, a));
  const setMember = mortgaged.find((i) => {
    const g = BOARD[i].group!;
    return GROUP_MEMBERS[g].every((m) => sameTeam(s, s.ownership[m].owner, me.id));
  });
  if (setMember !== undefined) return { type: 'unmortgage', space: setMember };

  const buildable = props
    .filter((i) => !canBuild(s, me.id, i) && me.cash - BOARD[i].houseCost! >= reserve)
    .sort((a, b) => {
      const ha = s.ownership[a].houses;
      const hb = s.ownership[b].houses;
      // Prefer reaching 3 houses (best ROI), then the more expensive group.
      return ha - hb || (BOARD[b].rent![3] ?? 0) - (BOARD[a].rent![3] ?? 0);
    });
  if (buildable.length) return { type: 'build', space: buildable[0] };

  if (mortgaged.length && me.cash - unmortgageCost(mortgaged[0]) > reserve * 3)
    return { type: 'unmortgage', space: mortgaged[0] };
  return null;
}

/**
 * Next action for a bot-controlled player, or null if it has nothing to do right now.
 * `autopilot` = a human who ran out of time: play safely and never spend.
 */
export function decideBotAction(s: GameState, playerId: string, autopilot = false): Action | null {
  const me = getPlayer(s, playerId);
  if (!me || me.bankrupt || s.phase === 'over') return null;

  const debt = resolveDebts(s, me);
  if (debt) return debt;

  if (s.phase === 'auction' && s.auction) {
    if (autopilot || s.auction.highBidder === me.id) return null;
    const limit = maxBid(s, me, s.auction.space);
    const next = s.auction.highBid + (s.auction.highBid < 100 ? 10 : 20);
    if (next <= limit && next <= me.cash) return { type: 'bid', amount: s.auction.highBid === 0 ? Math.min(limit, Math.max(10, Math.round((BOARD[s.auction.space].price ?? 0) * 0.3))) : next };
    return null;
  }

  if (!autopilot) {
    const incoming = s.trades.find((t) => t.to === me.id);
    if (incoming) {
      return evaluateTrade(s, me, incoming) > 0
        ? { type: 'acceptTrade', id: incoming.id }
        : { type: 'rejectTrade', id: incoming.id };
    }
  }

  if (activePlayer(s).id !== me.id) return null;

  switch (s.phase) {
    case 'roll':
      if (me.inJail && !autopilot) {
        const early = unownedCount(s) > 10;
        if (me.jailCards.length && early) return { type: 'useJailCard' };
        if (early && me.cash > JAIL_FINE + reserveFor(s, me) * 2) return { type: 'payJail' };
      }
      return { type: 'roll' };
    case 'buy':
      if (autopilot) return { type: 'decline' };
      return wantsToBuy(s, me, me.position) ? { type: 'buy' } : { type: 'decline' };
    case 'end':
      if (!autopilot) {
        const step = improve(s, me) ?? proposeSetTrade(s, me);
        if (step) return step;
      }
      return { type: 'endTurn' };
    default:
      return null;
  }
}

