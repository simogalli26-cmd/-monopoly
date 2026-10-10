import { useT } from '../i18n';
import type { Settings } from '../../shared/types';

interface Props {
  value: Settings;
  onChange?: (s: Settings) => void;
  compact?: boolean;
}

const TOGGLES: { key: keyof Settings; label: [string, string]; hint: [string, string] }[] = [
  {
    key: 'doubleRentOnSet',
    label: ['Affitto doppio sul gruppo completo', 'Double rent on full sets'],
    hint: ['Terreni senza case di un gruppo completo rendono il doppio.', 'Unimproved properties of a full set earn double rent.'],
  },
  {
    key: 'auctions',
    label: ['Aste', 'Auctions'],
    hint: ['Se chi ci capita non compra, la proprietà va all’asta tra tutti.', 'If the player who lands there doesn’t buy, everyone bids for it.'],
  },
  {
    key: 'freeParkingPot',
    label: ['Montepremi all’Area Relax', 'Chill Zone jackpot'],
    hint: ['Tasse e multe finiscono nel piatto: chi si ferma all’Area Relax lo vince.', 'Taxes and fines go into a pot won by landing on the Chill Zone.'],
  },
  {
    key: 'doubleGoOnLanding',
    label: ['Partenza doppia', 'Double Start'],
    hint: ['Fermarsi esattamente sulla Partenza paga 400.', 'Landing exactly on Start pays 400.'],
  },
  {
    key: 'noRentInJail',
    label: ['Niente affitti in prigione', 'No rent in jail'],
    hint: ['Chi è in prigione non riscuote gli affitti.', 'Players in jail don’t collect rent.'],
  },
  {
    key: 'evenBuild',
    label: ['Costruzione uniforme', 'Even building'],
    hint: ['Le case vanno distribuite in modo uniforme nel gruppo.', 'Houses must be spread evenly across the set.'],
  },
  {
    key: 'randomOrder',
    label: ['Ordine casuale', 'Random order'],
    hint: ['Mescola l’ordine dei giocatori all’inizio.', 'Shuffle the player order at the start.'],
  },
];

export function SettingsForm({ value, onChange, compact }: Props) {
  const t = useT();
  const readOnly = !onChange;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange?.({ ...value, [k]: v });

  return (
    <div className={`settings ${compact ? 'compact' : ''}`}>
      <div className="mode-picker" role="radiogroup" aria-label={t('Modalità', 'Mode')}>
        {(
          [
            ['none', '👤', t('Tutti contro tutti', 'Free for all'), t('2–8 giocatori', '2–8 players')],
            ['2v2', '👥', '2 vs 2', t('2 squadre da 2', '2 teams of 2')],
            ['3v3', '👨‍👩‍👦', '3 vs 3', t('2 squadre da 3', '2 teams of 3')],
          ] as const
        ).map(([mode, icon, label, sub]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.teamMode === mode}
            disabled={readOnly && value.teamMode !== mode}
            className={`mode-opt ${value.teamMode === mode ? 'sel' : ''}`}
            onClick={() =>
              onChange?.({ ...value, teamMode: mode, maxPlayers: mode === '2v2' ? 4 : mode === '3v3' ? 6 : Math.max(value.maxPlayers, 2) })
            }
          >
            <span className="mode-icon">{icon}</span>
            <b>{label}</b>
            <small>{sub}</small>
          </button>
        ))}
      </div>
      <div className="settings-grid">
        <label className="field">
          <span>{t('Soldi iniziali', 'Starting cash')}</span>
          <select disabled={readOnly} value={value.startingCash} onChange={(e) => set('startingCash', +e.target.value)}>
            {[1000, 1500, 2000, 2500, 3000].map((n) => (
              <option key={n} value={n}>
                ${n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Giocatori max', 'Max players')}</span>
          <select disabled={readOnly || value.teamMode !== 'none'} value={value.maxPlayers} onChange={(e) => set('maxPlayers', +e.target.value)}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Tempo per mossa', 'Time per move')}</span>
          <select disabled={readOnly} value={value.turnTime} onChange={(e) => set('turnTime', +e.target.value)}>
            {[0, 30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('Illimitato', 'Unlimited') : `${n} s`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Durata asta', 'Auction time')}</span>
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
        {TOGGLES.map((tg) => (
          <label key={tg.key} className={`toggle ${readOnly ? 'readonly' : ''}`} title={t(...tg.hint)}>
            <input
              type="checkbox"
              disabled={readOnly}
              checked={!!value[tg.key]}
              onChange={(e) => set(tg.key, e.target.checked as never)}
            />
            <span className="switch" aria-hidden />
            <span className="toggle-text">
              <b>{t(...tg.label)}</b>
              {!compact && <small>{t(...tg.hint)}</small>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
