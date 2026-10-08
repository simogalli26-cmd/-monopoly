import type { Settings } from '../../shared/types';

interface Props {
  value: Settings;
  onChange?: (s: Settings) => void;
  compact?: boolean;
}

const TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'doubleRentOnSet', label: 'Affitto doppio sul gruppo completo', hint: 'Terreni senza case di un gruppo completo rendono il doppio.' },
  { key: 'auctions', label: 'Aste', hint: 'Se chi ci capita non compra, la proprietà va all’asta tra tutti.' },
  { key: 'freeParkingPot', label: 'Montepremi all’Area Relax', hint: 'Tasse e multe finiscono nel piatto: chi si ferma all’Area Relax lo vince.' },
  { key: 'doubleGoOnLanding', label: 'Partenza doppia', hint: 'Fermarsi esattamente sulla Partenza paga 400.' },
  { key: 'noRentInJail', label: 'Niente affitti in prigione', hint: 'Chi è in prigione non riscuote gli affitti.' },
  { key: 'evenBuild', label: 'Costruzione uniforme', hint: 'Le case vanno distribuite in modo uniforme nel gruppo.' },
  { key: 'randomOrder', label: 'Ordine casuale', hint: 'Mescola l’ordine dei giocatori all’inizio.' },
];

export function SettingsForm({ value, onChange, compact }: Props) {
  const readOnly = !onChange;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange?.({ ...value, [k]: v });

  return (
    <div className={`settings ${compact ? 'compact' : ''}`}>
      <div className="settings-grid">
        <label className="field">
          <span>Soldi iniziali</span>
          <select disabled={readOnly} value={value.startingCash} onChange={(e) => set('startingCash', +e.target.value)}>
            {[1000, 1500, 2000, 2500, 3000].map((n) => (
              <option key={n} value={n}>
                ${n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Giocatori max</span>
          <select disabled={readOnly} value={value.maxPlayers} onChange={(e) => set('maxPlayers', +e.target.value)}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tempo per mossa</span>
          <select disabled={readOnly} value={value.turnTime} onChange={(e) => set('turnTime', +e.target.value)}>
            {[0, 30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Illimitato' : `${n} s`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Durata asta</span>
          <select disabled={readOnly} value={value.auctionTime} onChange={(e) => set('auctionTime', +e.target.value)}>
            {[5, 8, 12, 15].map((n) => (
              <option key={n} value={n}>
                {n} s
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="toggles">
        {TOGGLES.map((t) => (
          <label key={t.key} className={`toggle ${readOnly ? 'readonly' : ''}`} title={t.hint}>
            <input
              type="checkbox"
              disabled={readOnly}
              checked={!!value[t.key]}
              onChange={(e) => set(t.key, e.target.checked as never)}
            />
            <span className="switch" aria-hidden />
            <span className="toggle-text">
              <b>{t.label}</b>
              {!compact && <small>{t.hint}</small>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
