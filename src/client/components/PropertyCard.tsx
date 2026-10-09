import { GROUP_COLORS, GROUP_MEMBERS, mortgageValue, unmortgageCost } from '../../shared/board';
import { deckName, groupLabel, nameOf, spaceOf } from '../../shared/theme';
import { msg, useLang, useT } from '../i18n';
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
const HOUSE_LABELS_EN = ['Rent', 'With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With hotel'];

export function PropertyCard({ state, index, me, act, onTrade }: Props) {
  const t = useT();
  const lang = useLang();
  const sp = spaceOf(state.theme, index, lang);
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
              <td>{(lang === 'en' ? HOUSE_LABELS_EN : HOUSE_LABELS)[i]}</td>
              <td>${r}</td>
            </tr>
          ))}
          {state.settings.doubleRentOnSet && (
            <tr className="note">
              <td colSpan={2}>
                {t('Gruppo completo senza case: affitto doppio', 'Full set without houses: double rent')} (${sp.rent![0] * 2})
              </td>
            </tr>
          )}
          <tr className="sep">
            <td>{t('Costo casa / albergo', 'House / hotel cost')}</td>
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
                {n} {lang === 'en' ? (n === 1 ? 'airport' : 'airports') : n === 1 ? 'aeroporto' : 'aeroporti'}
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
        {t(
          'Con un servizio l’affitto è 4 volte il lancio dei dadi; con entrambi è 10 volte.',
          'With one utility the rent is 4 times the dice roll; with both it is 10 times.',
        )}
      </p>
    );
  } else {
    const desc: Record<string, string> = {
      go: t('Ogni volta che passi dalla Partenza ritiri $200.', 'Collect $200 every time you pass Start.'),
      chance: t(`Pesca una carta ${deckName('chance')}.`, `Draw a ${deckName('chance', 'en')} card.`),
      chest: t(`Pesca una carta ${deckName('chest')}.`, `Draw a ${deckName('chest', 'en')} card.`),
      tax: t(`Paga $${sp.tax} alla banca.`, `Pay $${sp.tax} to the bank.`),
      jail: t('Se sei solo di passaggio non succede nulla. Per uscire: doppio, $50 o carta.', 'Just visiting? Nothing happens. To get out: a double, $50 or a card.'),
      parking: state.settings.freeParkingPot
        ? t(`Vinci il montepremi accumulato ($${state.pot}).`, `Win the jackpot ($${state.pot}).`)
        : t('Riposati, qui non succede nulla.', 'Relax, nothing happens here.'),
      gotojail: t('Vai direttamente in prigione senza passare dalla Partenza.', 'Go directly to jail without passing Start.'),
    };
    body = <p className="muted">{desc[sp.type]}</p>;
  }

  const btn = (label: string, action: Action, err: string | null) => (
    <button className="btn small" disabled={!!err} title={err ? msg(err) : ''} onClick={() => act?.(action)}>
      {label}
    </button>
  );

  return (
    <div className="prop-card" style={{ ['--group' as string]: color }}>
      <div className={`prop-head ${sp.type === 'property' ? '' : 'plain'}`}>
        <small>{sp.group ? groupLabel(state.theme, sp.group, lang) : ''}</small>
        <div className="prop-icon">{sp.icon}</div>
        <h3>{sp.name}</h3>
        {sp.city && <span className="prop-city">📍 {sp.city}</span>}
        {sp.price && <span className="prop-price">${sp.price}</span>}
      </div>
      <div className="prop-body">
        {body}
        {sp.price && (
          <div className="prop-meta">
            <span>
              {t('Ipoteca', 'Mortgage')} <b>${mortgageValue(index)}</b>
            </span>
            {own.owner && (
              <span>
                {t('Affitto attuale', 'Current rent')} <b>${rentFor(state, index, 7)}</b>
                {sp.type === 'utility' ? t(' (con 7)', ' (with 7)') : ''}
              </span>
            )}
          </div>
        )}
        {sp.group && sp.type === 'property' && (
          <div className="group-row">
            {GROUP_MEMBERS[sp.group].map((i) => {
              const o = state.players.find((p) => p.id === state.ownership[i].owner);
              return (
                <span key={i} className="group-chip" style={{ borderColor: o?.color ?? 'transparent' }} title={o?.name ?? t('Libera', 'Available')}>
                  {nameOf(state.theme, i, lang)} {o ? o.token : '—'}
                </span>
              );
            })}
          </div>
        )}
        {sp.price && (
          <div className="prop-owner">
            {owner ? (
              <>
                {t('Proprietario:', 'Owner:')}{' '}
                <b style={{ color: owner.color }}>
                  {owner.token} {owner.name}
                </b>
                {own.mortgaged && <span className="badge danger">{t('Ipotecata', 'Mortgaged')}</span>}
              </>
            ) : (
              <span className="muted">{t('Disponibile', 'Available')}</span>
            )}
          </div>
        )}
        {mine && act && (
          <div className="prop-actions">
            {sp.type === 'property' && btn(own.houses === 4 ? `🏨 ${t('Albergo', 'Hotel')}` : `🏠 ${t('Costruisci', 'Build')} $${sp.houseCost}`, { type: 'build', space: index }, canBuild(state, me!, index))}
            {sp.type === 'property' && btn(`${t('Vendi edificio', 'Sell building')} +$${Math.floor(sp.houseCost! / 2)}`, { type: 'sell', space: index }, canSell(state, me!, index))}
            {own.mortgaged
              ? btn(`${t('Riscatta', 'Unmortgage')} $${unmortgageCost(index)}`, { type: 'unmortgage', space: index }, canUnmortgage(state, me!, index))
              : btn(`${t('Ipoteca', 'Mortgage')} +$${mortgageValue(index)}`, { type: 'mortgage', space: index }, canMortgage(state, me!, index))}
          </div>
        )}
        {!mine && owner && me && onTrade && !state.players.find((p) => p.id === me)?.bankrupt && state.phase !== 'over' && (
          <div className="prop-actions">
            <button className="btn small" onClick={() => onTrade(index)}>
              🤝 {t('Proponi scambio', 'Propose trade')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
