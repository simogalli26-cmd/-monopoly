import { useEffect, useState } from 'react';

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

function Die({ value, rolling, spin }: { value: number; rolling: boolean; spin: number }) {
  const extra = `rotateX(${spin * 720}deg) rotateY(${spin * 720}deg)`;
  return (
    <div className="die-scene">
      <div className={`die ${rolling ? 'rolling' : ''}`} style={{ transform: `${extra} ${FACE_ROT[value]}` }}>
        {FACES.map((f) => (
          <div key={f.n} className="face" style={{ transform: f.t }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f.n].includes(i) ? 'pip' : ''} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dice({ dice, seq }: { dice: [number, number]; seq: number }) {
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (!seq) return;
    setRolling(true);
    const t = setTimeout(() => setRolling(false), 650);
    return () => clearTimeout(t);
  }, [seq]);
  return (
    <div className={`dice ${dice[0] === dice[1] && seq ? 'double' : ''}`}>
      <Die value={dice[0]} rolling={rolling} spin={seq} />
      <Die value={dice[1]} rolling={rolling} spin={seq + 1} />
    </div>
  );
}
