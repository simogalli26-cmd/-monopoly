import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS, PLAYER_TOKENS } from '../../shared/board';
import { createGame } from '../../shared/engine';
import type { Profile } from '../../shared/protocol';
import { GameRunner } from '../../shared/runner';
import type { Action, GameState, PlayerSeat } from '../../shared/types';
import { Game } from './Game';
import type { OfflineConfig } from './Home';

const BOT_NAMES = ['Ada', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gaia'];
const ME = 'me';

function build(config: OfflineConfig, profile: Profile): GameState {
  const colors = PLAYER_COLORS.filter((c) => c !== profile.color);
  const tokens = PLAYER_TOKENS.filter((t) => t !== profile.token);
  const seats: PlayerSeat[] = [
    { id: ME, name: profile.name || 'Tu', color: profile.color, token: profile.token, isBot: false },
    ...Array.from({ length: config.bots }, (_, i) => ({
      id: `bot${i}`,
      name: `🤖 ${BOT_NAMES[i]}`,
      color: colors[i % colors.length],
      token: tokens[i % tokens.length],
      isBot: true,
      botLevel: config.level,
    })),
  ];
  return createGame({ id: 'offline', settings: config.settings, seats, now: Date.now(), theme: config.theme ?? null });
}

export function OfflineGame({ config, profile, onExit }: { config: OfflineConfig; profile: Profile; onExit: () => void }) {
  const runner = useRef<GameRunner | null>(null);
  const [state, setState] = useState<GameState>(() => build(config, profile));

  const start = useCallback(
    (initial: GameState) => {
      runner.current?.stop();
      const r = new GameRunner(initial, (s) => setState(s));
      runner.current = r;
      setState(initial);
      r.start();
    },
    [],
  );

  useEffect(() => {
    start(state);
    return () => runner.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (a: Action) => runner.current!.dispatch(ME, a), []);

  return (
    <Game
      state={state}
      me={ME}
      send={send}
      onExit={onExit}
      isHost
      offline
      onRematch={() => start(build(config, profile))}
    />
  );
}
