import { BOARD, GROUP_COLORS, GROUP_NAMES, GROUP_MEMBERS, mortgageValue, unmortgageCost } from '../../shared/board';
import { canBuild, canMortgage, canSell, canUnmortgage, rentFor } from '../../shared/engine';
import type { Action, GameState } from '../../shared/types';

interface Props {
  state: GameState;
  index: number;
  me?: string | null;
  act?: (a: Action) => void;
  onTrade?: (index: number) => void;
}

const HOUSE_LABELS = ['Affitto', 'Con 1 casa', 'Con 2 case', 'Con 3 case', 'Con 4 case', 'Con albergo'];

export function PropertyCard({ state, index, me, act, onTrade }: Props) {
  const sp = BOARD[index];
  const own = state.ownership[index];
  const owner = state.players.find((p) => p.id === own.owner);
  const color = sp.group ? GROUP_COLORS[sp.group] : '#555';
  const mine = !!me && own.owner === me;

  let body;
  if (sp.type === 'property') {
    body = (
      <table className="rent-table">
        <tbody>
          {sp.rent!.map((r, i) => (
            <tr key={i} className={own.owner && own.houses === i ? 'cur' : ''}>
              <td>{HOUSE_LABELS[i]}</td>
              <td>${r}</td>
            </tr>
          ))}
          {state.settings.doubleRentOnSet && (
            <tr className="note">
              <td colSpan={2}>Gruppo completo senza case: affitto doppio (${sp.rent![0] * 2})</td>
            </tr>
          )}
          <tr className="sep">
            <td>Costo casa / albergo</td>
            <td>${sp.houseCost}</td>
          </tr>
        </tbody>
      </table>
    );
  } else if (sp.type === 'airport') {
    body = (
      <table className="rent-table">
        <tbody>
          {[1, 2, 3, 4].map((n) => (
            <tr key={n}>
              <td>
                {n} aeropor{n === 1 ? 'to' : 'ti'}
              </td>
              <td>${25 * 2 ** (n - 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (sp.type === 'utility') {
    body = (
      <p className="muted small">
        Con un servizio l'affitto è 4 volte il lancio dei dadi; con entrambi è 10 volte.
      </p>
    );
  } else {
    const desc: Record<string, string> = {
      go: 'Ogni volta che passi dal VIA ritiri $200.',
      chance: 'Pesca una carta Imprevisti.',
      chest: 'Pesca una carta Probabilità.',
      tax: `Paga $${sp.tax} alla banca.`,
      jail: 'Se sei solo di passaggio non succede nulla. Per uscire: doppio, $50 o carta.',
      parking: state.settings.freeParkingPot ? `Vinci il montepremi accumulato ($${state.pot}).` : 'Riposati, qui non succede nulla.',
      gotojail: 'Vai direttamente in prigione senza passare dal VIA.',
    };
    body = <p className="muted">{desc[sp.type]}</p>;
  }

  const btn = (label: string, action: Action, err: string | null) => (
    <button className="btn small" disabled={!!err} title={err ?? ''} onClick={() => act?.(action)}>
      {label}
    </button>
  );

  return (
    <div className="prop-card" style={{ ['--group' as string]: color }}>
      <div className={`prop-head ${sp.type === 'property' ? '' : 'plain'}`}>
        <small>{sp.group ? GROUP_NAMES[sp.group] : ''}</small>
        <h3>
          {sp.icon} {sp.name}
        </h3>
        {sp.price && <span className="prop-price">${sp.price}</span>}
      </div>
      <div className="prop-body">
        {body}
        {sp.price && (
          <div className="prop-meta">
            <span>
              Ipoteca <b>${mortgageValue(index)}</b>
            </span>
            {own.owner && (
              <span>
                Affitto attuale <b>${rentFor(state, index, 7)}</b>
                {sp.type === 'utility' ? ' (con 7)' : ''}
              </span>
            )}
          </div>
        )}
        {sp.group && sp.type === 'property' && (
          <div className="group-row">
            {GROUP_MEMBERS[sp.group].map((i) => {
              const o = state.players.find((p) => p.id === state.ownership[i].owner);
              return (
                <span key={i} className="group-chip" style={{ borderColor: o?.color ?? 'transparent' }} title={o?.name ?? 'Libera'}>
                  {BOARD[i].name} {o ? o.token : '—'}
                </span>
              );
            })}
          </div>
        )}
        {sp.price && (
          <div className="prop-owner">
            {owner ? (
              <>
                Proprietario:{' '}
                <b style={{ color: owner.color }}>
                  {owner.token} {owner.name}
                </b>
                {own.mortgaged && <span className="badge danger">Ipotecata</span>}
              </>
            ) : (
              <span className="muted">Disponibile</span>
            )}
          </div>
        )}
        {mine && act && (
          <div className="prop-actions">
            {sp.type === 'property' && btn(own.houses === 4 ? '🏨 Albergo' : `🏠 Costruisci $${sp.houseCost}`, { type: 'build', space: index }, canBuild(state, me!, index))}
            {sp.type === 'property' && btn(`Vendi edificio +$${Math.floor(sp.houseCost! / 2)}`, { type: 'sell', space: index }, canSell(state, me!, index))}
            {own.mortgaged
              ? btn(`Riscatta $${unmortgageCost(index)}`, { type: 'unmortgage', space: index }, canUnmortgage(state, me!, index))
              : btn(`Ipoteca +$${mortgageValue(index)}`, { type: 'mortgage', space: index }, canMortgage(state, me!, index))}
          </div>
        )}
        {!mine && owner && me && onTrade && !state.players.find((p) => p.id === me)?.bankrupt && state.phase !== 'over' && (
          <div className="prop-actions">
            <button className="btn small" onClick={() => onTrade(index)}>
              🤝 Proponi scambio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
