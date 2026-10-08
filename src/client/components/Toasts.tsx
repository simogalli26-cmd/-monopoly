import { useEffect, useState } from 'react';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

let seq = 0;
const listeners = new Set<(t: Toast) => void>();

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const t = { id: ++seq, text, kind };
  listeners.forEach((l) => l(t));
}

export function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (t: Toast) => {
      setItems((xs) => [...xs.slice(-3), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3500);
    };
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
