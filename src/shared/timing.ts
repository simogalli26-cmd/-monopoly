import type { GameState } from './types';

/** How long the dice tumble before the token starts moving. */
export const DICE_MS = 1500;
/** Short pause after the token arrives, before results are revealed. */
export const LAND_PAUSE_MS = 350;
/** Extra time given to read a drawn card. */
export const CARD_READ_MS = 2200;

/** Milliseconds per tile: normal walks are slower, long card jumps faster. */
export const stepMs = (steps: number) => (steps > 12 ? 85 : 190);

/** Tiles a token visibly walks between two positions (0 = teleport, e.g. to jail). */
export function walkSteps(from: number, to: number, jailed: boolean): number {
  if (from === to || (jailed && to === 10)) return 0;
  const fwd = (to - from + 40) % 40;
  return fwd >= 37 ? 40 - fwd : fwd;
}

/** Duration of the dice + movement animation that a state change triggers. */
export function moveDuration(prev: GameState, next: GameState): number {
  if (next.rollSeq === prev.rollSeq) {
    // Card movements without a roll are not possible today, but keep the walk timing generic.
    return 0;
  }
  let walk = 0;
  for (const p of next.players) {
    const before = prev.players.find((x) => x.id === p.id);
    if (!before) continue;
    const steps = walkSteps(before.position, p.position, p.inJail);
    walk = Math.max(walk, steps * stepMs(steps));
  }
  return DICE_MS + walk + LAND_PAUSE_MS;
}

/** Full time a viewer needs to follow a state change (animation + reading a card). */
export function followDuration(prev: GameState, next: GameState): number {
  const card = next.lastCard && next.lastCard.seq !== prev.lastCard?.seq ? CARD_READ_MS : 0;
  return moveDuration(prev, next) + card;
}
