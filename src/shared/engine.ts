import {
  BOARD,
  BOARD_SIZE,
  CHANCE_CARDS,
  CHEST_CARDS,
  GO_SALARY,
  GROUP_MEMBERS,
  JAIL_FINE,
  JAIL_INDEX,
  isOwnable,
  mortgageValue,
  unmortgageCost,
  type Card,
} from './board';
import { DECK_NAMES, cardText, deckName, nameOf, type BoardTheme } from './theme';
import type {
  Action,
  Deck,
  GameState,
  Group,
  LogKind,
  Phase,
  Player,
  PlayerSeat,
  Settings,
  TradeDraft,
  TradeOffer,
} from './types';

export class EngineError extends Error {}

const fail = (msg: string): never => {
  throw new EngineError(msg);
};

const MAX_LOG = 200;
const AUCTION_MIN_EXTEND_MS = 4000;
const MAX_OUTGOING_TRADES = 3;

// ---------------------------------------------------------------- helpers

/** Mulberry32 PRNG stored in the state so games are reproducible. */
export function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const cardsOf = (deck: Deck): Card[] => (deck === 'chance' ? CHANCE_CARDS : CHEST_CARDS);

export const getPlayer = (s: GameState, id: string | null | undefined): Player | undefined =>
  s.players.find((p) => p.id === id);

export const activePlayer = (s: GameState): Player => s.players[s.turn];

export const alivePlayers = (s: GameState): Player[] => s.players.filter((p) => !p.bankrupt);

export const propertiesOf = (s: GameState, id: string): number[] =>
  s.ownership.map((o, i) => (o.owner === id ? i : -1)).filter((i) => i >= 0);

export const debtsOf = (s: GameState, id: string) => s.debts.filter((d) => d.from === id);

export const totalDebt = (s: GameState, id: string): number =>
  debtsOf(s, id).reduce((sum, d) => sum + d.amount, 0);

/** Players on the same side: themselves, or teammates in team games. */
export function sameTeam(s: GameState, a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const pa = getPlayer(s, a);
  const pb = getPlayer(s, b);
  return pa?.team !== undefined && pa.team === pb?.team;
}

export const TEAM_SIZE: Record<string, number> = { '2v2': 2, '3v3': 3 };
export const isTeamGame = (s: GameState) => s.settings.teamMode !== 'none' && s.players.some((p) => p.team !== undefined);

/** True when `id` (with their teammates) owns the whole color group. */
export function hasFullSet(s: GameState, group: Group, id: string): boolean {
  return GROUP_MEMBERS[group].every((i) => sameTeam(s, s.ownership[i].owner, id));
}

export function rentFor(s: GameState, index: number, diceTotal: number): number {
  const space = BOARD[index];
  const own = s.ownership[index];
  if (!own.owner || own.mortgaged) return 0;
  if (space.type === 'property') {
    if (own.houses > 0) return space.rent![own.houses];
    const base = space.rent![0];
    return s.settings.doubleRentOnSet && hasFullSet(s, space.group!, own.owner) ? base * 2 : base;
  }
  const count = GROUP_MEMBERS[space.group!].filter((i) => sameTeam(s, s.ownership[i].owner, own.owner)).length;
  if (space.type === 'airport') return 25 * 2 ** (count - 1);
  if (space.type === 'utility') return diceTotal * (count >= 2 ? 10 : 4);
  return 0;
}

/** Cash + market value of everything owned (used for rankings and bots). */
export function netWorth(s: GameState, id: string): number {
  const p = getPlayer(s, id);
  if (!p || p.bankrupt) return 0;
  return propertiesOf(s, id).reduce((sum, i) => {
    const own = s.ownership[i];
    const sp = BOARD[i];
    return sum + (own.mortgaged ? mortgageValue(i) : sp.price ?? 0) + own.houses * (sp.houseCost ?? 0);
  }, p.cash);
}

/** Cash a player could raise by selling all buildings and mortgaging everything. */
export function liquidationValue(s: GameState, id: string): number {
  const p = getPlayer(s, id);
  if (!p) return 0;
  return propertiesOf(s, id).reduce((sum, i) => {
    const own = s.ownership[i];
    const sp = BOARD[i];
    return sum + own.houses * Math.floor((sp.houseCost ?? 0) / 2) + (own.mortgaged ? 0 : mortgageValue(i));
  }, p.cash);
}

function log(s: GameState, text: string, kind: LogKind = 'info', en?: string) {
  s.log.push({ id: ++s.logSeq, text, en, kind });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

const money = (n: number) => `$${n}`;
/** English name of a space (custom boards keep their own texts). */
const en = (s: GameState, i: number) => nameOf(s.theme, i, 'en');

function setPhase(s: GameState, phase: Phase, now: number) {
  s.phase = phase;
  s.turnDeadline = s.settings.turnTime > 0 && phase !== 'over' ? now + s.settings.turnTime * 1000 : null;
}

// ---------------------------------------------------------------- setup

export function createGame(opts: {
  id: string;
  settings: Settings;
  seats: PlayerSeat[];
  seed?: number;
  now: number;
  theme?: BoardTheme | null;
}): GameState {
  const { settings, now } = opts;
  const s: GameState = {
    id: opts.id,
    theme: opts.theme ?? null,
    settings: { ...settings },
    players: [],
    ownership: BOARD.map(() => ({ owner: null, houses: 0, mortgaged: false })),
    turn: 0,
    round: 1,
    phase: 'roll',
    dice: [1, 1],
    rollSeq: 0,
    rolledDoubles: false,
    pot: 0,
    decks: { chance: [], chest: [] },
    auction: null,
    trades: [],
    debts: [],
    log: [],
    logSeq: 0,
    lastCard: null,
    winner: null,
    turnDeadline: null,
    seed: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
    startedAt: now,
    version: 0,
  };
  let seats = [...opts.seats];
  if (settings.randomOrder) shuffle(s, seats);
  if (settings.teamMode !== 'none' && seats.every((x) => x.team === 0 || x.team === 1)) {
    // Alternate the teams: Blue, Red, Blue, Red…
    const a = seats.filter((x) => x.team === 0);
    const b = seats.filter((x) => x.team === 1);
    const first = rand(s) < 0.5 ? a : b;
    const second = first === a ? b : a;
    seats = first.flatMap((x, i) => (second[i] ? [x, second[i]] : [x])).concat(second.slice(first.length));
  } else {
    seats = seats.map(({ team: _team, ...x }) => x);
  }
  s.players = seats.map((seat) => ({
    ...seat,
    cash: settings.startingCash,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailCards: [],
    bankrupt: false,
    doubles: 0,
  }));
  s.decks.chance = shuffle(s, CHANCE_CARDS.map((_, i) => i));
  s.decks.chest = shuffle(s, CHEST_CARDS.map((_, i) => i));
  log(s, 'La partita è iniziata! Buona fortuna a tutti.', 'turn', 'The game has started! Good luck everyone.');
  if (s.players[0]) log(s, `Tocca a ${s.players[0].name}.`, 'turn', `${s.players[0].name}’s turn.`);
  setPhase(s, 'roll', now);
  return s;
}

// ---------------------------------------------------------------- money

function credit(s: GameState, to: string | null, amount: number, toPot = false) {
  if (to) {
    const p = getPlayer(s, to);
    if (p && !p.bankrupt) p.cash += amount;
  } else if (toPot && s.settings.freeParkingPot) {
    s.pot += amount;
  }
}

/** Charges a player; if they can't pay the amount becomes a debt to settle. */
function charge(
  s: GameState,
  fromId: string,
  to: string | null,
  amount: number,
  reason: string,
  now: number,
  toPot = false,
  reasonEn = reason,
): boolean {
  if (amount <= 0) return true;
  const from = getPlayer(s, fromId)!;
  if (from.cash >= amount && debtsOf(s, fromId).length === 0) {
    from.cash -= amount;
    credit(s, to, amount, toPot);
    return true;
  }
  s.debts.push({ from: fromId, to, amount, reason, reasonEn, toPot, createdAt: now });
  log(
    s,
    `${from.name} non ha abbastanza contanti per pagare ${money(amount)} (${reason}): deve ipotecare, vendere o dichiarare bancarotta.`,
    'danger',
    `${from.name} can’t pay ${money(amount)} (${reasonEn}): they must mortgage, sell or go bankrupt.`,
  );
  return false;
}

// ---------------------------------------------------------------- movement

function sendToJail(s: GameState, p: Player) {
  p.position = JAIL_INDEX;
  p.inJail = true;
  p.jailTurns = 0;
  p.doubles = 0;
  if (activePlayer(s).id === p.id) s.rolledDoubles = false;
  log(s, `${p.name} finisce in prigione!`, 'jail', `${p.name} goes to jail!`);
}

function moveForward(s: GameState, p: Player, steps: number) {
  const target = (p.position + steps) % BOARD_SIZE;
  moveTo(s, p, target);
}

function moveTo(s: GameState, p: Player, target: number) {
  const passedGo = target < p.position || target === 0;
  if (passedGo && p.position !== target) {
    const double = target === 0 && s.settings.doubleGoOnLanding;
    const salary = double ? GO_SALARY * 2 : GO_SALARY;
    p.cash += salary;
    log(s, `${p.name} ${target === 0 ? 'si ferma sulla' : 'passa dalla'} Partenza e ritira ${money(salary)}.`, 'money', `${p.name} ${target === 0 ? 'lands on' : 'passes'} Start and collects ${money(salary)}.`);
  }
  p.position = target;
}

interface LandMods {
  airportMultiplier?: number;
  utilityTenX?: boolean;
}

function landOn(s: GameState, p: Player, now: number, mods: LandMods = {}) {
  const space = BOARD[p.position];
  const diceTotal = s.dice[0] + s.dice[1];
  switch (space.type) {
    case 'property':
    case 'airport':
    case 'utility': {
      const own = s.ownership[p.position];
      if (!own.owner) {
        setPhase(s, 'buy', now);
        return;
      }
      if (own.owner === p.id) return;
      const owner = getPlayer(s, own.owner)!;
      if (sameTeam(s, owner.id, p.id)) {
        log(s, `${p.name} è ospite di ${owner.name}, compagno di squadra: niente affitto.`, 'info', `${p.name} is ${owner.name}’s teammate: no rent.`);
        return;
      }
      if (own.mortgaged) {
        log(s, `${nameOf(s.theme, p.position)} è ipotecata: nessun affitto.`, 'info', `${en(s, p.position)} is mortgaged: no rent.`);
        return;
      }
      if (owner.inJail && s.settings.noRentInJail) {
        log(s, `${owner.name} è in prigione e non riscuote l'affitto di ${nameOf(s.theme, p.position)}.`, 'info', `${owner.name} is in jail and collects no rent for ${en(s, p.position)}.`);
        return;
      }
      let rent = rentFor(s, p.position, diceTotal);
      if (space.type === 'airport' && mods.airportMultiplier) rent *= mods.airportMultiplier;
      if (space.type === 'utility' && mods.utilityTenX) rent = diceTotal * 10;
      log(s, `${p.name} paga ${money(rent)} di affitto a ${owner.name} per ${nameOf(s.theme, p.position)}.`, 'money', `${p.name} pays ${money(rent)} rent to ${owner.name} for ${en(s, p.position)}.`);
      charge(s, p.id, owner.id, rent, `affitto ${nameOf(s.theme, p.position)}`, now, false, `rent for ${en(s, p.position)}`);
      return;
    }
    case 'tax':
      log(s, `${p.name} paga ${money(space.tax!)} di ${space.name.toLowerCase()}.`, 'money', `${p.name} pays ${money(space.tax!)} ${en(s, p.position).toLowerCase()}.`);
      charge(s, p.id, null, space.tax!, space.name, now, true, en(s, p.position));
      return;
    case 'chance':
    case 'chest':
      drawCard(s, p, space.type, now);
      return;
    case 'gotojail':
      sendToJail(s, p);
      return;
    case 'parking':
      if (s.settings.freeParkingPot && s.pot > 0) {
        log(s, `${p.name} vince il montepremi dell’Area Relax: ${money(s.pot)}!`, 'money', `${p.name} wins the Chill Zone jackpot: ${money(s.pot)}!`);
        p.cash += s.pot;
        s.pot = 0;
      }
      return;
    default:
      return;
  }
}

function drawCard(s: GameState, p: Player, deck: Deck, now: number) {
  const pile = s.decks[deck];
  const cardIdx = pile.shift()!;
  const card = cardsOf(deck)[cardIdx];
  s.lastCard = { seq: (s.lastCard?.seq ?? 0) + 1, deck, card: cardIdx, playerId: p.id };
  log(s, `${p.name} pesca ${DECK_NAMES[deck]}: “${cardText(s.theme, card.text)}”`, 'card', `${p.name} draws ${deckName(deck, 'en')}: “${cardText(s.theme, card.en, 'en')}”`);
  const e = card.effect;
  if (e.kind !== 'jailFree') pile.push(cardIdx);
  switch (e.kind) {
    case 'advance':
      moveTo(s, p, e.to);
      landOn(s, p, now);
      return;
    case 'nearest': {
      let i = p.position;
      do i = (i + 1) % BOARD_SIZE;
      while (BOARD[i].group !== e.group);
      moveTo(s, p, i);
      landOn(s, p, now, e.group === 'airport' ? { airportMultiplier: 2 } : { utilityTenX: true });
      return;
    }
    case 'back':
      p.position = (p.position - e.steps + BOARD_SIZE) % BOARD_SIZE;
      landOn(s, p, now);
      return;
    case 'cash':
      if (e.amount >= 0) p.cash += e.amount;
      else charge(s, p.id, null, -e.amount, 'carta', now, true, 'card');
      return;
    case 'eachPlayer':
      for (const other of alivePlayers(s)) {
        if (other.id === p.id) continue;
        if (e.amount < 0) charge(s, p.id, other.id, -e.amount, `carta (a ${other.name})`, now, false, `card (to ${other.name})`);
        else charge(s, other.id, p.id, e.amount, `regalo a ${p.name}`, now, false, `gift to ${p.name}`);
      }
      return;
    case 'repairs': {
      let total = 0;
      for (const i of propertiesOf(s, p.id)) {
        const h = s.ownership[i].houses;
        total += h === 5 ? e.hotel : h * e.house;
      }
      if (total > 0) {
        log(s, `${p.name} paga ${money(total)} di manutenzione.`, 'money', `${p.name} pays ${money(total)} for repairs.`);
        charge(s, p.id, null, total, 'manutenzione', now, true, 'repairs');
      }
      return;
    }
    case 'jail':
      sendToJail(s, p);
      return;
    case 'jailFree':
      p.jailCards.push(deck);
      return;
  }
}

/** Called after a landing has been fully resolved. */
function afterLanding(s: GameState, now: number) {
  if (s.phase === 'over') return;
  const p = activePlayer(s);
  if (p.bankrupt) return;
  if (s.rolledDoubles && !p.inJail) {
    setPhase(s, 'roll', now);
    log(s, `${p.name} ha fatto doppio: tira di nuovo!`, 'turn', `${p.name} rolled a double: roll again!`);
  } else {
    setPhase(s, 'end', now);
  }
}

function nextTurn(s: GameState, now: number) {
  if (s.phase === 'over') return;
  const n = s.players.length;
  let i = s.turn;
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n;
    if (i === 0) s.round++;
    if (!s.players[i].bankrupt) break;
  }
  s.turn = i;
  s.rolledDoubles = false;
  const p = s.players[i];
  p.doubles = 0;
  log(s, `Tocca a ${p.name}.`, 'turn', `${p.name}’s turn.`);
  setPhase(s, 'roll', now);
}

export const TEAM_NAMES = [
  ['Squadra Blu', 'Blue Team'],
  ['Squadra Rossa', 'Red Team'],
] as const;
export const TEAM_COLORS = ['#3fb6ff', '#ff5d73'];
export const TEAM_ICONS = ['🔵', '🔴'];

function checkWinner(s: GameState, now: number) {
  const alive = alivePlayers(s);
  const teams = new Set(alive.map((p) => p.team));
  if (isTeamGame(s) && alive.length > 1 && teams.size === 1) {
    const team = alive[0].team!;
    s.winner = alive[0].id;
    s.winnerTeam = team;
    s.auction = null;
    s.trades = [];
    setPhase(s, 'over', now);
    log(s, `🏆 Vince la ${TEAM_NAMES[team][0]}!`, 'turn', `🏆 The ${TEAM_NAMES[team][1]} wins!`);
    return;
  }
  if (alive.length <= 1) {
    s.winner = alive[0]?.id ?? null;
    s.winnerTeam = alive[0]?.team ?? null;
    s.auction = null;
    s.trades = [];
    setPhase(s, 'over', now);
    if (alive[0]) log(s, `🏆 ${alive[0].name} vince la partita!`, 'turn', `🏆 ${alive[0].name} wins the game!`);
  }
}

// ---------------------------------------------------------------- building

function groupOf(index: number): number[] {
  return GROUP_MEMBERS[BOARD[index].group!];
}

export function canBuild(s: GameState, id: string, index: number): string | null {
  const sp = BOARD[index];
  const own = s.ownership[index];
  if (sp?.type !== 'property') return 'Non edificabile';
  if (own.owner !== id) return 'Non è tua';
  if (!hasFullSet(s, sp.group!, id)) return 'Ti serve tutto il gruppo';
  const group = groupOf(index);
  if (group.some((i) => s.ownership[i].mortgaged)) return 'Una proprietà del gruppo è ipotecata';
  if (own.houses >= 5) return 'Hai già un albergo';
  if (s.settings.evenBuild && own.houses > Math.min(...group.map((i) => s.ownership[i].houses)))
    return 'Costruisci in modo uniforme';
  if (getPlayer(s, id)!.cash < sp.houseCost!) return 'Contanti insufficienti';
  return null;
}

export function canSell(s: GameState, id: string, index: number): string | null {
  const own = s.ownership[index];
  if (own.owner !== id) return 'Non è tua';
  if (own.houses <= 0) return 'Nessun edificio';
  if (s.settings.evenBuild && own.houses < Math.max(...groupOf(index).map((i) => s.ownership[i].houses)))
    return 'Vendi in modo uniforme';
  return null;
}

export function canMortgage(s: GameState, id: string, index: number): string | null {
  const own = s.ownership[index];
  if (!isOwnable(index) || own.owner !== id) return 'Non è tua';
  if (own.mortgaged) return 'Già ipotecata';
  if (BOARD[index].type === 'property' && groupOf(index).some((i) => s.ownership[i].houses > 0))
    return 'Vendi prima gli edifici del gruppo';
  return null;
}

export function canUnmortgage(s: GameState, id: string, index: number): string | null {
  const own = s.ownership[index];
  if (own.owner !== id) return 'Non è tua';
  if (!own.mortgaged) return 'Non è ipotecata';
  if (getPlayer(s, id)!.cash < unmortgageCost(index)) return 'Contanti insufficienti';
  return null;
}

// ---------------------------------------------------------------- trades

export function validateTrade(s: GameState, from: string, t: TradeDraft): string | null {
  const a = getPlayer(s, from);
  const b = getPlayer(s, t.to);
  if (!a || !b || a.bankrupt || b.bankrupt) return 'Giocatore non valido';
  if (a.id === b.id) return 'Non puoi scambiare con te stesso';
  const ints = [t.giveCash, t.getCash, t.giveCards, t.getCards];
  if (ints.some((n) => !Number.isInteger(n) || n < 0)) return 'Valori non validi';
  if (t.giveCash > a.cash) return `${a.name} non ha abbastanza contanti`;
  if (t.getCash > b.cash) return `${b.name} non ha abbastanza contanti`;
  if (t.giveCards > a.jailCards.length || t.getCards > b.jailCards.length) return 'Carte non disponibili';
  const checkProps = (props: number[], owner: string) =>
    props.every(
      (i) =>
        isOwnable(i) &&
        s.ownership[i].owner === owner &&
        !(BOARD[i].type === 'property' && groupOf(i).some((g) => s.ownership[g].houses > 0)),
    );
  if (new Set(t.giveProps).size !== t.giveProps.length || new Set(t.getProps).size !== t.getProps.length)
    return 'Proprietà duplicate';
  if (!checkProps(t.giveProps, a.id) || !checkProps(t.getProps, b.id))
    return 'Proprietà non valide (o con edifici nel gruppo)';
  const empty = !t.giveProps.length && !t.getProps.length && !t.giveCash && !t.getCash && !t.giveCards && !t.getCards;
  if (empty) return 'Lo scambio è vuoto';
  return null;
}

function transferCards(from: Player, to: Player, n: number) {
  for (let k = 0; k < n; k++) to.jailCards.push(from.jailCards.pop()!);
}

function pruneTrades(s: GameState) {
  s.trades = s.trades.filter((t) => validateTrade(s, t.from, t) === null);
}

// ---------------------------------------------------------------- bankruptcy

function declareBankruptcy(s: GameState, p: Player, now: number) {
  const debts = debtsOf(s, p.id);
  const creditors = [...new Set(debts.map((d) => d.to))];
  const creditor = creditors.length === 1 && creditors[0] ? getPlayer(s, creditors[0]) : undefined;

  // Buildings are sold back to the bank at half price.
  for (const i of propertiesOf(s, p.id)) {
    const own = s.ownership[i];
    if (own.houses > 0) {
      p.cash += own.houses * Math.floor(BOARD[i].houseCost! / 2);
      own.houses = 0;
    }
  }

  if (creditor && !creditor.bankrupt) {
    creditor.cash += Math.max(0, p.cash);
    for (const i of propertiesOf(s, p.id)) s.ownership[i].owner = creditor.id;
    transferCards(p, creditor, p.jailCards.length);
    log(s, `💥 ${p.name} dichiara bancarotta! Tutti i suoi beni passano a ${creditor.name}.`, 'danger', `💥 ${p.name} goes bankrupt! All their assets go to ${creditor.name}.`);
  } else if (isTeamGame(s) && alivePlayers(s).some((x) => x.id !== p.id && x.team === p.team)) {
    // In team games what's left stays in the team.
    const mate = alivePlayers(s).find((x) => x.id !== p.id && x.team === p.team)!;
    for (const i of propertiesOf(s, p.id)) s.ownership[i].owner = mate.id;
    transferCards(p, mate, p.jailCards.length);
    log(s, `💥 ${p.name} dichiara bancarotta! Le sue proprietà passano al compagno ${mate.name}.`, 'danger', `💥 ${p.name} goes bankrupt! Their properties go to teammate ${mate.name}.`);
  } else {
    for (const i of propertiesOf(s, p.id)) s.ownership[i] = { owner: null, houses: 0, mortgaged: false };
    for (const deck of p.jailCards) s.decks[deck].push(cardsOf(deck).findIndex((c) => c.effect.kind === 'jailFree'));
    p.jailCards = [];
    log(s, `💥 ${p.name} dichiara bancarotta! Le sue proprietà tornano alla banca.`, 'danger', `💥 ${p.name} goes bankrupt! Their properties return to the bank.`);
  }

  p.cash = 0;
  p.bankrupt = true;
  p.bankruptOrder = s.players.filter((x) => x.bankrupt).length;
  s.debts = s.debts.filter((d) => d.from !== p.id && d.to !== p.id);
  s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
  if (s.auction?.highBidder === p.id) {
    s.auction.highBidder = null;
    s.auction.highBid = 0;
  }
  pruneTrades(s);
  checkWinner(s, now);
  if (s.phase !== 'over' && activePlayer(s).id === p.id) {
    if (s.phase === 'auction' && s.auction) return; // turn passes when the auction closes
    nextTurn(s, now);
  }
}

// ---------------------------------------------------------------- auctions

function startAuction(s: GameState, space: number, now: number) {
  s.auction = { space, highBid: 0, highBidder: null, endsAt: now + s.settings.auctionTime * 1000 + 2000 };
  setPhase(s, 'auction', now);
  s.turnDeadline = null;
  log(s, `🔨 Asta per ${nameOf(s.theme, space)}!`, 'buy', `🔨 Auction for ${en(s, space)}!`);
}

function closeAuction(s: GameState, now: number) {
  const a = s.auction!;
  s.auction = null;
  const winner = getPlayer(s, a.highBidder);
  if (winner && !winner.bankrupt && winner.cash >= a.highBid) {
    winner.cash -= a.highBid;
    s.ownership[a.space].owner = winner.id;
    log(s, `${winner.name} si aggiudica ${nameOf(s.theme, a.space)} per ${money(a.highBid)}.`, 'buy', `${winner.name} wins ${en(s, a.space)} for ${money(a.highBid)}.`);
  } else {
    log(s, `Nessuna offerta: ${nameOf(s.theme, a.space)} resta alla banca.`, 'info', `No bids: ${en(s, a.space)} stays with the bank.`);
  }
  if (activePlayer(s).bankrupt) nextTurn(s, now);
  else afterLanding(s, now);
}

/** Resolves time-based events. Returns true if the state changed. */
export function tick(s: GameState, now: number): boolean {
  if (s.phase === 'auction' && s.auction && now >= s.auction.endsAt) {
    closeAuction(s, now);
    s.version++;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- actions

function requireTurn(s: GameState, p: Player, phase: Phase | Phase[]) {
  if (activePlayer(s).id !== p.id) fail('Non è il tuo turno');
  const phases = Array.isArray(phase) ? phase : [phase];
  if (!phases.includes(s.phase)) fail('Azione non disponibile ora');
}

function requireNoDebt(s: GameState, p: Player) {
  if (debtsOf(s, p.id).length) fail('Devi prima saldare i tuoi debiti');
}

function rollDice(s: GameState): [number, number] {
  return [1 + Math.floor(rand(s) * 6), 1 + Math.floor(rand(s) * 6)];
}

function doRoll(s: GameState, p: Player, now: number) {
  const dice = rollDice(s);
  s.dice = dice;
  s.rollSeq++;
  const total = dice[0] + dice[1];
  const isDouble = dice[0] === dice[1];
  log(s, `${p.name} tira ${dice[0]} + ${dice[1]} = ${total}${isDouble ? ' (doppio!)' : ''}.`, 'info', `${p.name} rolls ${dice[0]} + ${dice[1]} = ${total}${isDouble ? ' (double!)' : ''}.`);

  if (p.inJail) {
    if (isDouble) {
      p.inJail = false;
      p.jailTurns = 0;
      s.rolledDoubles = false;
      log(s, `${p.name} esce di prigione con un doppio!`, 'jail', `${p.name} gets out of jail with a double!`);
    } else {
      p.jailTurns++;
      if (p.jailTurns < 3) {
        log(s, `${p.name} resta in prigione (tentativo ${p.jailTurns}/3).`, 'jail', `${p.name} stays in jail (attempt ${p.jailTurns}/3).`);
        setPhase(s, 'end', now);
        return;
      }
      p.inJail = false;
      p.jailTurns = 0;
      log(s, `${p.name} paga ${money(JAIL_FINE)} dopo il terzo tentativo ed esce di prigione.`, 'jail', `${p.name} pays ${money(JAIL_FINE)} after the third attempt and leaves jail.`);
      charge(s, p.id, null, JAIL_FINE, 'cauzione', now, true, 'bail');
    }
  } else if (isDouble) {
    p.doubles++;
    if (p.doubles >= 3) {
      log(s, `Tre doppi di fila: eccesso di velocità!`, 'jail', 'Three doubles in a row: speeding!');
      sendToJail(s, p);
      setPhase(s, 'end', now);
      return;
    }
    s.rolledDoubles = true;
  } else {
    s.rolledDoubles = false;
  }

  moveForward(s, p, total);
  s.phase = 'end'; // provisional: landOn switches to 'buy' when needed
  landOn(s, p, now);
  if ((s.phase as Phase) !== 'buy') afterLanding(s, now);
}

export function applyAction(state: GameState, playerId: string, action: Action, now: number): GameState {
  const s: GameState = structuredClone(state);
  const p = getPlayer(s, playerId);
  if (!p) fail('Giocatore sconosciuto');
  if (p!.bankrupt) fail('Sei in bancarotta');
  if (s.phase === 'over') fail('La partita è finita');
  reduce(s, p!, action, now);
  s.version++;
  return s;
}

function reduce(s: GameState, p: Player, action: Action, now: number) {
  switch (action.type) {
    case 'roll':
      requireTurn(s, p, 'roll');
      requireNoDebt(s, p);
      doRoll(s, p, now);
      return;

    case 'payJail':
      requireTurn(s, p, 'roll');
      if (!p.inJail) fail('Non sei in prigione');
      if (p.cash < JAIL_FINE) fail('Contanti insufficienti');
      p.cash -= JAIL_FINE;
      credit(s, null, JAIL_FINE, true);
      p.inJail = false;
      p.jailTurns = 0;
      log(s, `${p.name} paga la cauzione di ${money(JAIL_FINE)}.`, 'jail', `${p.name} pays ${money(JAIL_FINE)} bail.`);
      return;

    case 'useJailCard': {
      requireTurn(s, p, 'roll');
      if (!p.inJail) fail('Non sei in prigione');
      const deck = p.jailCards.pop() ?? fail('Non hai carte');
      s.decks[deck].push(cardsOf(deck).findIndex((c) => c.effect.kind === 'jailFree'));
      p.inJail = false;
      p.jailTurns = 0;
      log(s, `${p.name} usa la carta “Esci gratis di prigione”.`, 'jail', `${p.name} uses a “Get out of jail free” card.`);
      return;
    }

    case 'buy': {
      requireTurn(s, p, 'buy');
      const sp = BOARD[p.position];
      if (p.cash < sp.price!) fail('Contanti insufficienti');
      p.cash -= sp.price!;
      s.ownership[p.position].owner = p.id;
      log(s, `${p.name} compra ${nameOf(s.theme, p.position)} per ${money(sp.price!)}.`, 'buy', `${p.name} buys ${en(s, p.position)} for ${money(sp.price!)}.`);
      afterLanding(s, now);
      return;
    }

    case 'decline':
      requireTurn(s, p, 'buy');
      if (s.settings.auctions) startAuction(s, p.position, now);
      else {
        log(s, `${p.name} non compra ${nameOf(s.theme, p.position)}.`, 'info', `${p.name} doesn’t buy ${en(s, p.position)}.`);
        afterLanding(s, now);
      }
      return;

    case 'bid': {
      if (s.phase !== 'auction' || !s.auction) fail('Nessuna asta in corso');
      requireNoDebt(s, p);
      const amount = Math.floor(action.amount);
      if (!(amount > s.auction!.highBid)) fail('Offerta troppo bassa');
      if (amount > p.cash) fail('Contanti insufficienti');
      s.auction!.highBid = amount;
      s.auction!.highBidder = p.id;
      s.auction!.endsAt = Math.max(s.auction!.endsAt, now + Math.max(AUCTION_MIN_EXTEND_MS, s.settings.auctionTime * 1000));
      log(s, `${p.name} offre ${money(amount)}.`, 'buy', `${p.name} bids ${money(amount)}.`);
      return;
    }

    case 'build': {
      const err = canBuild(s, p.id, action.space);
      if (err) fail(err);
      const sp = BOARD[action.space];
      p.cash -= sp.houseCost!;
      const own = s.ownership[action.space];
      own.houses++;
      log(s, `${p.name} costruisce ${own.houses === 5 ? 'un albergo' : 'una casa'} a ${nameOf(s.theme, action.space)}.`, 'build', `${p.name} builds ${own.houses === 5 ? 'a hotel' : 'a house'} on ${en(s, action.space)}.`);
      pruneTrades(s);
      return;
    }

    case 'sell': {
      const err = canSell(s, p.id, action.space);
      if (err) fail(err);
      const sp = BOARD[action.space];
      const own = s.ownership[action.space];
      own.houses--;
      p.cash += Math.floor(sp.houseCost! / 2);
      log(s, `${p.name} vende un edificio a ${nameOf(s.theme, action.space)}.`, 'build', `${p.name} sells a building on ${en(s, action.space)}.`);
      return;
    }

    case 'mortgage': {
      const err = canMortgage(s, p.id, action.space);
      if (err) fail(err);
      s.ownership[action.space].mortgaged = true;
      p.cash += mortgageValue(action.space);
      log(s, `${p.name} ipoteca ${nameOf(s.theme, action.space)} (+${money(mortgageValue(action.space))}).`, 'money', `${p.name} mortgages ${en(s, action.space)} (+${money(mortgageValue(action.space))}).`);
      return;
    }

    case 'unmortgage': {
      const err = canUnmortgage(s, p.id, action.space);
      if (err) fail(err);
      s.ownership[action.space].mortgaged = false;
      p.cash -= unmortgageCost(action.space);
      log(s, `${p.name} riscatta ${nameOf(s.theme, action.space)}.`, 'money', `${p.name} unmortgages ${en(s, action.space)}.`);
      return;
    }

    case 'payDebt': {
      const debts = debtsOf(s, p.id);
      if (!debts.length) fail('Non hai debiti');
      if (p.cash < debts[0].amount) fail('Contanti insufficienti');
      for (const d of debts) {
        if (p.cash < d.amount) break;
        p.cash -= d.amount;
        credit(s, d.to, d.amount, d.toPot);
        s.debts.splice(s.debts.indexOf(d), 1);
        log(s, `${p.name} salda un debito di ${money(d.amount)} (${d.reason}).`, 'money', `${p.name} pays a debt of ${money(d.amount)} (${d.reasonEn ?? d.reason}).`);
      }
      return;
    }

    case 'bankrupt':
      declareBankruptcy(s, p, now);
      return;

    case 'endTurn':
      requireTurn(s, p, 'end');
      requireNoDebt(s, p);
      nextTurn(s, now);
      return;

    case 'proposeTrade': {
      const draft: TradeDraft = {
        to: String(action.offer.to),
        giveProps: [...(action.offer.giveProps ?? [])],
        getProps: [...(action.offer.getProps ?? [])],
        giveCash: action.offer.giveCash ?? 0,
        getCash: action.offer.getCash ?? 0,
        giveCards: action.offer.giveCards ?? 0,
        getCards: action.offer.getCards ?? 0,
      };
      const err = validateTrade(s, p.id, draft);
      if (err) fail(err);
      if (s.trades.filter((t) => t.from === p.id).length >= MAX_OUTGOING_TRADES)
        fail('Hai già troppe proposte in sospeso');
      const offer: TradeOffer = { ...draft, id: `t${s.version}-${Math.floor(rand(s) * 1e6)}`, from: p.id, createdAt: now };
      s.trades.push(offer);
      log(s, `${p.name} propone uno scambio a ${getPlayer(s, draft.to)!.name}.`, 'trade', `${p.name} offers a trade to ${getPlayer(s, draft.to)!.name}.`);
      return;
    }

    case 'acceptTrade': {
      const t = s.trades.find((x) => x.id === action.id) ?? fail('Proposta non trovata');
      if (t.to !== p.id) fail('Questa proposta non è per te');
      const err = validateTrade(s, t.from, t);
      if (err) {
        s.trades = s.trades.filter((x) => x.id !== t.id);
        fail(`Scambio non più valido: ${err}`);
      }
      const a = getPlayer(s, t.from)!;
      const b = p;
      for (const i of t.giveProps) s.ownership[i].owner = b.id;
      for (const i of t.getProps) s.ownership[i].owner = a.id;
      a.cash += t.getCash - t.giveCash;
      b.cash += t.giveCash - t.getCash;
      transferCards(a, b, t.giveCards);
      transferCards(b, a, t.getCards);
      s.trades = s.trades.filter((x) => x.id !== t.id);
      pruneTrades(s);
      log(s, `🤝 ${b.name} accetta lo scambio con ${a.name}.`, 'trade', `🤝 ${b.name} accepts the trade with ${a.name}.`);
      return;
    }

    case 'rejectTrade': {
      const t = s.trades.find((x) => x.id === action.id) ?? fail('Proposta non trovata');
      if (t.to !== p.id) fail('Questa proposta non è per te');
      s.trades = s.trades.filter((x) => x.id !== t.id);
      log(s, `${p.name} rifiuta lo scambio di ${getPlayer(s, t.from)!.name}.`, 'trade', `${p.name} rejects ${getPlayer(s, t.from)!.name}’s trade.`);
      return;
    }

    case 'cancelTrade': {
      const t = s.trades.find((x) => x.id === action.id) ?? fail('Proposta non trovata');
      if (t.from !== p.id) fail('Non è una tua proposta');
      s.trades = s.trades.filter((x) => x.id !== t.id);
      return;
    }

    default:
      fail('Azione sconosciuta');
  }
}
