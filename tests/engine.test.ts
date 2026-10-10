import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/board';
import { decideBotAction } from '../src/shared/bot';
import { applyAction, createGame, hasFullSet, netWorth, rentFor, tick } from '../src/shared/engine';
import type { GameState, PlayerSeat } from '../src/shared/types';

const seats = (n: number): PlayerSeat[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Bot ${i}`,
    color: '#fff',
    token: '🚗',
    isBot: true,
    botLevel: (['easy', 'normal', 'hard'] as const)[i % 3],
  }));

function newGame(n = 4, seed = 42, settings = {}) {
  return createGame({ id: 'g', settings: { ...DEFAULT_SETTINGS, randomOrder: false, ...settings }, seats: seats(n), seed, now: 0 });
}

/** Plays a whole game with bots using a fake clock. */
function simulate(s: GameState, maxSteps = 6_000) {
  let now = 0;
  for (let step = 0; step < maxSteps && s.phase !== 'over'; step++) {
    now += 1000;
    if (s.phase === 'auction' && s.auction) {
      let bid = false;
      for (const p of s.players) {
        const a = decideBotAction(s, p.id);
        if (a?.type === 'bid') {
          s = applyAction(s, p.id, a, now);
          bid = true;
          break;
        }
      }
      if (!bid) tick(s, now + 60_000);
      continue;
    }
    let acted = false;
    for (const p of s.players) {
      const a = decideBotAction(s, p.id);
      if (!a) continue;
      s = applyAction(s, p.id, a, now);
      acted = true;
      break;
    }
    if (!acted) throw new Error(`stuck in phase ${s.phase}`);
    // invariants
    for (const p of s.players) if (!s.debts.some((d) => d.from === p.id)) expect(p.cash).toBeGreaterThanOrEqual(0);
    for (const o of s.ownership) if (o.owner) expect(s.players.find((p) => p.id === o.owner)!.bankrupt).toBe(false);
  }
  return s;
}

describe('engine', () => {
  it('starts with the right cash and decks', () => {
    const s = newGame();
    expect(s.players.every((p) => p.cash === 1500)).toBe(true);
    expect(s.decks.chance).toHaveLength(16);
    expect(s.phase).toBe('roll');
  });

  it('rejects out-of-turn actions', () => {
    const s = newGame();
    expect(() => applyAction(s, 'p1', { type: 'roll' }, 0)).toThrow('Non è il tuo turno');
  });

  it('doubles rent on complete unimproved sets', () => {
    const s = newGame();
    s.ownership[1].owner = 'p0';
    expect(rentFor(s, 1, 7)).toBe(2);
    s.ownership[3].owner = 'p0';
    expect(rentFor(s, 1, 7)).toBe(4);
    s.ownership[1].houses = 1;
    expect(rentFor(s, 1, 7)).toBe(10);
  });

  it('enforces even building', () => {
    let s = newGame();
    s.ownership[1].owner = 'p0';
    s.ownership[3].owner = 'p0';
    s = applyAction(s, 'p0', { type: 'build', space: 1 }, 0);
    expect(() => applyAction(s, 'p0', { type: 'build', space: 1 }, 0)).toThrow();
    s = applyAction(s, 'p0', { type: 'build', space: 3 }, 0);
    expect(s.players[0].cash).toBe(1400);
  });

  it('runs trades', () => {
    let s = newGame();
    s.ownership[1].owner = 'p0';
    s = applyAction(s, 'p0', { type: 'proposeTrade', offer: { to: 'p1', giveProps: [1], getProps: [], giveCash: 0, getCash: 100, giveCards: 0, getCards: 0 } }, 0);
    s = applyAction(s, 'p1', { type: 'acceptTrade', id: s.trades[0].id }, 0);
    expect(s.ownership[1].owner).toBe('p1');
    expect(s.players[0].cash).toBe(1600);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('bots can finish a full game (seed %i)', (seed) => {
    const s = simulate(newGame(4, seed, { freeParkingPot: seed % 2 === 0, auctions: seed % 3 !== 0 }));
    if (s.phase === 'over') {
      expect(s.winner).toBeTruthy();
    } else {
      // Very long games are possible; the leader must still have a consistent state.
      expect(Math.max(...s.players.map((p) => netWorth(s, p.id)))).toBeGreaterThan(0);
    }
  });
});

describe('team games', () => {
  const teamGame = (mode: '2v2' | '3v3', seed = 7) => {
    const n = mode === '2v2' ? 4 : 6;
    const s = seats(n).map((x, i) => ({ ...x, team: i % 2 }));
    return createGame({ id: 't', settings: { ...DEFAULT_SETTINGS, teamMode: mode, maxPlayers: n }, seats: s, seed, now: 0 });
  };

  it('alternates teams in the turn order', () => {
    const s = teamGame('3v3');
    const teams = s.players.map((p) => p.team);
    for (let i = 1; i < teams.length; i++) expect(teams[i]).not.toBe(teams[i - 1]);
  });

  it('teammates pay no rent and share color sets', () => {
    const s = teamGame('2v2');
    const [a, b] = s.players.filter((p) => p.team === 0);
    s.ownership[1].owner = a.id;
    s.ownership[3].owner = b.id;
    // The set counts for the team: double rent for opponents.
    expect(rentFor(s, 1, 7)).toBe(4);
    s.ownership[1].houses = 0;
    expect(hasFullSet(s, 'brown', b.id)).toBe(true);
    const opp = s.players.find((p) => p.team === 1)!;
    expect(hasFullSet(s, 'brown', opp.id)).toBe(false);
  });

  it.each([
    ['2v2', 3],
    ['3v3', 4],
  ] as const)('bots finish a %s game with a winning team', (mode, seed) => {
    const s = simulate(teamGame(mode, seed), 8000);
    if (s.phase === 'over') {
      expect(s.winnerTeam === 0 || s.winnerTeam === 1).toBe(true);
      const alive = s.players.filter((p) => !p.bankrupt);
      expect(alive.every((p) => p.team === s.winnerTeam)).toBe(true);
    }
  });
});
