import { useMemo, useState } from 'react';
import { spaceOf } from '../../shared/theme';
import { BOARD, GROUP_COLORS, GROUP_MEMBERS } from '../../shared/board';
import { propertiesOf, validateTrade } from '../../shared/engine';
import type { GameState, TradeDraft } from '../../shared/types';
import { Modal } from './Modal';
import { msg, useLang, useT } from '../i18n';

interface Props {
  state: GameState;
  me: string;
  initial?: Partial<TradeDraft>;
  onSend: (d: TradeDraft) => void;
  onClose: () => void;
}

function PropPicker({
  state,
  owner,
  selected,
  toggle,
}: {
  state: GameState;
  owner: string;
  selected: number[];
  toggle: (i: number) => void;
}) {
  const t = useT();
  const lang = useLang();
  const props = propertiesOf(state, owner);
  if (!props.length) return <p className="muted small">{t('Nessuna proprietà', 'No properties')}</p>;
  return (
    <div className="pick-list">
      {props.map((i) => {
        const sp = spaceOf(state.theme, i, lang);
        const own = state.ownership[i];
        const blocked = sp.type === 'property' && GROUP_MEMBERS[sp.group!].some((g) => state.ownership[g].houses > 0);
        return (
          <button
            key={i}
            disabled={blocked}
            title={blocked ? t('Vendi prima gli edifici del gruppo', 'Sell the buildings in the set first') : ''}
            className={`pick ${selected.includes(i) ? 'sel' : ''}`}
            style={{ ['--group' as string]: GROUP_COLORS[sp.group!] }}
            onClick={() => toggle(i)}
          >
            <i className="pick-color" />
            <span>{sp.short ?? sp.name}</span>
            {own.mortgaged && <small>{t('ipot.', 'mortg.')}</small>}
            <small className="muted">${sp.price}</small>
          </button>
        );
      })}
    </div>
  );
}

export function TradeModal({ state, me, initial, onSend, onClose }: Props) {
  const t = useT();
  const others = state.players.filter((p) => p.id !== me && !p.bankrupt);
  const [d, setD] = useState<TradeDraft>({
    to: initial?.to ?? others[0]?.id ?? '',
    giveProps: initial?.giveProps ?? [],
    getProps: initial?.getProps ?? [],
    giveCash: initial?.giveCash ?? 0,
    getCash: initial?.getCash ?? 0,
    giveCards: initial?.giveCards ?? 0,
    getCards: initial?.getCards ?? 0,
  });
  const meP = state.players.find((p) => p.id === me)!;
  const them = state.players.find((p) => p.id === d.to);
  const error = useMemo(() => validateTrade(state, me, d), [state, me, d]);

  const toggle = (key: 'giveProps' | 'getProps') => (i: number) =>
    setD((x) => ({ ...x, [key]: x[key].includes(i) ? x[key].filter((v) => v !== i) : [...x[key], i] }));

  const worth = (props: number[], cash: number) => props.reduce((s, i) => s + (BOARD[i].price ?? 0), 0) + cash;

  return (
    <Modal title={t('Proponi uno scambio', 'Propose a trade')} onClose={onClose} className="wide">
      <div className="trade-who">
        {others.map((p) => (
          <button
            key={p.id}
            className={`who ${d.to === p.id ? 'sel' : ''}`}
            style={{ ['--pc' as string]: p.color }}
            onClick={() => setD({ ...d, to: p.id, getProps: [], getCash: 0, getCards: 0 })}
          >
            {p.token} {p.name}
          </button>
        ))}
      </div>
      {them && (
        <div className="trade-cols">
          <div className="trade-col">
            <h4>
              {t('Tu dai', 'You give')} <span className="muted">(${meP.cash} {t('disponibili', 'available')})</span>
            </h4>
            <PropPicker state={state} owner={me} selected={d.giveProps} toggle={toggle('giveProps')} />
            <label className="field">
              <span>{t('Contanti', 'Cash')}</span>
              <input
                type="number"
                min={0}
                max={meP.cash}
                step={10}
                value={d.giveCash}
                onChange={(e) => setD({ ...d, giveCash: Math.max(0, Math.floor(+e.target.value || 0)) })}
              />
            </label>
            {meP.jailCards.length > 0 && (
              <label className="field">
                <span>{t('Carte “esci di prigione”', 'Get out of jail cards')}</span>
                <input type="number" min={0} max={meP.jailCards.length} value={d.giveCards} onChange={(e) => setD({ ...d, giveCards: +e.target.value })} />
              </label>
            )}
            <div className="trade-sum">{t('Valore', 'Value')}: ${worth(d.giveProps, d.giveCash)}</div>
          </div>
          <div className="trade-arrows">⇄</div>
          <div className="trade-col">
            <h4>
              {them.token} {them.name} {t('dà', 'gives')} <span className="muted">(${them.cash})</span>
            </h4>
            <PropPicker state={state} owner={them.id} selected={d.getProps} toggle={toggle('getProps')} />
            <label className="field">
              <span>{t('Contanti', 'Cash')}</span>
              <input
                type="number"
                min={0}
                max={them.cash}
                step={10}
                value={d.getCash}
                onChange={(e) => setD({ ...d, getCash: Math.max(0, Math.floor(+e.target.value || 0)) })}
              />
            </label>
            {them.jailCards.length > 0 && (
              <label className="field">
                <span>{t('Carte “esci di prigione”', 'Get out of jail cards')}</span>
                <input type="number" min={0} max={them.jailCards.length} value={d.getCards} onChange={(e) => setD({ ...d, getCards: +e.target.value })} />
              </label>
            )}
            <div className="trade-sum">{t('Valore', 'Value')}: ${worth(d.getProps, d.getCash)}</div>
          </div>
        </div>
      )}
      <div className="modal-actions">
        {error && <span className="muted small">{msg(error)}</span>}
        <button className="btn ghost" onClick={onClose}>
          {t('Annulla', 'Cancel')}
        </button>
        <button className="btn primary" disabled={!!error} onClick={() => onSend(d)}>
          {t('Invia proposta', 'Send offer')}
        </button>
      </div>
    </Modal>
  );
}
