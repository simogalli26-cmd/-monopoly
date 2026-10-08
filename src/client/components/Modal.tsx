import { useEffect, type ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ title, onClose, children, className = '' }: Props) {
  useEffect(() => {
    if (!onClose) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${className}`} role="dialog" aria-modal>
        {(title || onClose) && (
          <div className="modal-head">
            <h3>{title}</h3>
            {onClose && (
              <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
