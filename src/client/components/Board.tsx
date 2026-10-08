import { memo, type ReactNode } from 'react';
import { BOARD, GROUP_COLORS } from '../../shared/board';
import type { GameState, Player } from '../../shared/types';

export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export function tileCell(i: number): { row: number; col: number; side: Side } {
  if (i % 10 === 0) {
    const corners: Record<number, [number, number]> = { 0: [11, 11], 10: [11, 1], 20: [1, 1], 30: [1, 11] };
    const [row, col] = corners[i];
    return { row, col, side: 'corner' };
  }
  if (i < 10) return { row: 11, col: 11 - i, side: 'bottom' };
  if (i < 20) return { row: 21 - i, col: 1, side: 'left' };
  if (i < 30) return { row: 1, col: i - 19, side: 'top' };
  return { row: i - 29, col: 11, side: 'right' };
}

const CORNER = 1.5;
const UNITS = 9 + CORNER * 2;
const axisCenter = (c: number) => {
  const start = c === 1 ? 0 : CORNER + (c - 2);
  const width = c === 1 || c === 11 ? CORNER : 1;
  return ((start + width / 2) / UNITS) * 100;
};

/** Center of a tile in % of the board. */
export function tileCenter(i: number): { x: number; y: number } {
  const { row, col } = tileCell(i);
  return { x: axisCenter(col), y: axisCenter(row) };
}

interface Props {
  state: GameState;
  positions: Record<string, number>;
  highlight?: number | null;
  onTile: (i: number) => void;
  center: ReactNode;
  movingId?: string | null;
}

const Tile = memo(function Tile({
  index,
  owner,
  houses,
  mortgaged,
  highlight,
  onTile,
  pot,
}: {
  index: number;
  owner?: Player;
  houses: number;
  mortgaged: boolean;
  highlight: boolean;
  onTile: (i: number) => void;
  pot: number;
}) {
  const sp = BOARD[index];
  const { row, col, side } = tileCell(index);
  const color = sp.group ? GROUP_COLORS[sp.group] : undefined;
  const style = {
    gridRow: row,
    gridColumn: col,
    ['--owner' as string]: owner?.color,
    ['--group' as string]: color,
  };
  const classes = [
    'tile',
    `side-${side}`,
    `t-${sp.type}`,
    owner ? 'owned' : '',
    mortgaged ? 'mortgaged' : '',
    highlight ? 'hl' : '',
  ].join(' ');

  if (side === 'corner') {
    return (
      <button className={classes} style={style} onClick={() => onTile(index)} aria-label={sp.name}>
        <span className="corner-icon">{sp.icon}</span>
        <span className="corner-name">{sp.short ?? sp.name}</span>
        {sp.type === 'parking' && pot > 0 && <span className="pot">${pot}</span>}
        {sp.type === 'jail' && <span className="corner-sub">solo in visita</span>}
      </button>
    );
  }

  return (
    <button className={classes} style={style} onClick={() => onTile(index)} aria-label={sp.name}>
      {sp.type === 'property' && (
        <span className="band">
          {houses > 0 && houses < 5 && (
            <span className="houses">
              {Array.from({ length: houses }, (_, k) => (
                <i key={k} className="house" />
              ))}
            </span>
          )}
          {houses === 5 && <i className="hotel" />}
        </span>
      )}
      <span className="tile-body">
        <span className="tile-icon">{sp.icon}</span>
        <span className="tile-name">{sp.short ?? sp.name}</span>
        {sp.price ? (
          <span className="tile-price">${sp.price}</span>
        ) : sp.tax ? (
          <span className="tile-price">-${sp.tax}</span>
        ) : null}
      </span>
      {owner && <span className="owner-flag" />}
    </button>
  );
});

export function Board({ state, positions, highlight, onTile, center, movingId }: Props) {
  const playersAt = new Map<number, Player[]>();
  for (const p of state.players) {
    if (p.bankrupt) continue;
    const pos = positions[p.id] ?? p.position;
    playersAt.set(pos, [...(playersAt.get(pos) ?? []), p]);
  }

  return (
    <div className="board-wrap">
      <div className="board">
        {BOARD.map((sp) => {
          const own = state.ownership[sp.index];
          return (
            <Tile
              key={sp.index}
              index={sp.index}
              owner={state.players.find((p) => p.id === own.owner)}
              houses={own.houses}
              mortgaged={own.mortgaged}
              highlight={highlight === sp.index}
              onTile={onTile}
              pot={state.pot}
            />
          );
        })}
        <div className="board-center">{center}</div>
        <div className="tokens-layer" aria-hidden>
          {state.players.map((p) => {
            if (p.bankrupt) return null;
            const pos = positions[p.id] ?? p.position;
            const here = playersAt.get(pos) ?? [];
            const k = here.indexOf(p);
            const { x, y } = tileCenter(pos);
            const n = here.length;
            const angle = (k / Math.max(1, n)) * Math.PI * 2;
            const spread = n > 1 ? 2.1 : 0;
            const jailOffset = pos === 10 && p.inJail ? { dx: 1.2, dy: -1.2 } : pos === 10 ? { dx: -1.6, dy: 1.6 } : { dx: 0, dy: 0 };
            const active = state.players[state.turn]?.id === p.id;
            return (
              <div
                key={p.id}
                className={`token ${active ? 'active' : ''} ${movingId === p.id ? 'moving' : ''} ${p.inJail ? 'jailed' : ''}`}
                style={{
                  left: `${x + Math.cos(angle) * spread + jailOffset.dx}%`,
                  top: `${y + Math.sin(angle) * spread + jailOffset.dy}%`,
                  ['--pc' as string]: p.color,
                }}
                title={p.name}
              >
                <span>{p.token}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
