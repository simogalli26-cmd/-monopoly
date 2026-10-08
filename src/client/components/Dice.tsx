import { useEffect, useRef, useState } from 'react';
import { DICE_MS } from '../../shared/timing';
import { sfx } from '../sound';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Rotation that shows each face to the viewer.
const FACE_ROT: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
};

const FACES = [
  { n: 1, t: 'translateZ(var(--half))' },
  { n: 2, t: 'rotateY(90deg) translateZ(var(--half))' },
  { n: 3, t: 'rotateX(90deg) translateZ(var(--half))' },
  { n: 4, t: 'rotateX(-90deg) translateZ(var(--half))' },
  { n: 5, t: 'rotateY(-90deg) translateZ(var(--half))' },
  { n: 6, t: 'rotateY(180deg) translateZ(var(--half))' },
];

function Die({ value, rolling, seq, offset }: { value: number; rolling: boolean; seq: number; offset: number }) {
  // Each roll adds a few full turns (multiples of 360° keep the final face correct).
  const turns = seq * 4 + offset;
  const extra = `rotateX(${turns * 360}deg) rotateY(${(turns + 1) * 360}deg) rotateZ(${seq * 360}deg)`;
  return (
    <div className={`die-scene ${rolling ? 'tossing' : ''}`} style={{ animationDelay: `${offset * 60}ms` }}>
      <div
        className={`die ${rolling ? 'rolling' : ''}`}
        style={{ transform: `${extra} ${FACE_ROT[value]}`, transitionDuration: `${DICE_MS - 150}ms` }}
      >
        {FACES.map((f) => (
          <div key={f.n} className="face" style={{ transform: f.t }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f.n].includes(i) ? 'pip' : ''} />
            ))}
          </div>
        ))}
      </div>
      <div className="die-shadow" />
    </div>
  );
}

export function Dice({ dice, seq }: { dice: [number, number]; seq: number }) {
  const [rolling, setRolling] = useState(false);
  const first = useRef(seq);
  useEffect(() => {
    if (!seq || seq === first.current) return;
    setRolling(true);
    sfx.dice();
    const t = setTimeout(() => setRolling(false), DICE_MS);
    return () => clearTimeout(t);
  }, [seq]);
  return (
    <div className={`dice ${dice[0] === dice[1] && seq && !rolling ? 'double' : ''}`}>
      <Die value={dice[0]} rolling={rolling} seq={seq} offset={0} />
      <Die value={dice[1]} rolling={rolling} seq={seq} offset={1} />
    </div>
  );
}
