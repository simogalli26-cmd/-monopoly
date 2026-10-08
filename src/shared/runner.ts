import { decideBotAction } from './bot';
import { EngineError, activePlayer, applyAction, debtsOf, tick } from './engine';
import type { Action, GameState } from './types';

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

const TICK_MS = 250;
const DEBT_GRACE_MS = 45_000;

/**
 * Owns a game state: applies actions, drives bots, auctions and turn timers.
 * Used both by the server (online rooms) and by the browser (offline games vs bots).
 */
export class GameRunner {
  state: GameState;
  /** Humans temporarily controlled by the AI (e.g. disconnected). */
  readonly autopilot = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private botReadyAt = new Map<string, number>();

  constructor(
    state: GameState,
    private onChange: (s: GameState) => void,
    private botSpeed = 1,
  ) {
    this.state = state;
  }

  start() {
    if (!this.timer) this.timer = setInterval(() => this.loop(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispatch(playerId: string, action: Action): DispatchResult {
    try {
      this.state = applyAction(this.state, playerId, action, Date.now());
    } catch (e) {
      if (e instanceof EngineError) return { ok: false, error: e.message };
      throw e;
    }
    this.afterChange();
    return { ok: true };
  }

  private afterChange() {
    const now = Date.now();
    for (const p of this.state.players) {
      if (p.isBot || this.autopilot.has(p.id)) {
        const delay = this.state.phase === 'auction' ? 500 + Math.random() * 900 : 650 + Math.random() * 450;
        this.botReadyAt.set(p.id, Math.max(this.botReadyAt.get(p.id) ?? 0, now + delay / this.botSpeed));
      }
    }
    this.onChange(this.state);
    if (this.state.phase === 'over') this.stop();
  }

  private loop() {
    const now = Date.now();
    const s = this.state;
    if (s.phase === 'over') return this.stop();

    if (tick(s, now)) return this.afterChange();

    // Bots and autopiloted humans.
    for (const p of s.players) {
      if (p.bankrupt) continue;
      const auto = this.autopilot.has(p.id);
      if (!p.isBot && !auto) continue;
      if ((this.botReadyAt.get(p.id) ?? 0) > now) continue;
      const action = decideBotAction(this.state, p.id, false);
      if (!action) continue;
      const res = this.dispatch(p.id, action);
      if (!res.ok) this.botReadyAt.set(p.id, now + 1500); // avoid hot loops on unexpected errors
      return; // one action per tick keeps things readable
    }

    // Turn timer for humans who are not answering.
    const active = activePlayer(this.state);
    if (this.state.turnDeadline && now > this.state.turnDeadline && !active.isBot) {
      const action = decideBotAction(this.state, active.id, true);
      if (action) {
        const res = this.dispatch(active.id, action);
        if (!res.ok) this.state.turnDeadline = now + 5000;
        return;
      }
    }

    // Humans stuck with debts for too long (timer on).
    if (this.state.settings.turnTime > 0) {
      for (const d of this.state.debts) {
        if (now - d.createdAt < Math.max(DEBT_GRACE_MS, this.state.settings.turnTime * 2000)) continue;
        const p = this.state.players.find((x) => x.id === d.from);
        if (!p || p.isBot || !debtsOf(this.state, p.id).length) continue;
        const action = decideBotAction(this.state, p.id, true);
        if (action) {
          this.dispatch(p.id, action);
          return;
        }
      }
    }
  }
}
