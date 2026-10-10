import { useEffect, useRef, useState } from 'react';
import { DECK_ICONS, cardText, deckName, shortOf, spaceOf } from '../../shared/theme';
import type { Lang } from '../../shared/i18n';
import { BOARD, GROUP_COLORS, GROUP_MEMBERS, JAIL_FINE } from '../../shared/board';
import { TEAM_COLORS, TEAM_ICONS, TEAM_NAMES, activePlayer, cardsOf, isTeamGame, debtsOf, getPlayer, liquidationValue, netWorth, propertiesOf, totalDebt } from '../../shared/engine';
import type { Action, ColorGroup, DrawnCard, GameState, LogEntry, Player, TradeOffer } from '../../shared/types';
import { Modal } from './Modal';
import { logText, useLang, useT } from '../i18n';

const COLOR_GROUPS: ColorGroup[] = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'];

// ---------------------------------------------------------------- players

function CashDelta({ cash }: { cash: number }) {
  const prev = useRef(cash);
  const [deltas, setDeltas] = useState<{ id: number; v: number }[]>([]);
  useEffect(() => {
    const diff = cash - prev.current;
    prev.current = cash;
    if (!diff) return;
    const id = Date.now() + Math.random();
    setDeltas((d) => [...d, { id, v: diff }]);
    const t = setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1600);
    return () => clearTimeout(t);
  }, [cash]);
  return (
    <span className="cash-deltas">
      {deltas.map((d) => (
        <span key={d.id} className={`delta ${d.v > 0 ? 'up' : 'down'}`}>
          {d.v > 0 ? '+' : '−'}${Math.abs(d.v)}
        </span>
      ))}
    </span>
  );
}

function GroupDots({ state, id }: { state: GameState; id: string }) {
  return (
    <div className="group-dots">
      {COLOR_GROUPS.map((g) => {
        const members = GROUP_MEMBERS[g];
        const owned = members.filter((i) => state.ownership[i].owner === id).length;
        if (!owned) return null;
        return (
          <span key={g} className={`gdot ${owned === members.length ? 'full' : ''}`} style={{ ['--group' as string]: GROUP_COLORS[g] }}>
            {owned}/{members.length}
          </span>
        );
      })}
      {(['airport', 'utility'] as const).map((g) => {
        const owned = GROUP_MEMBERS[g].filter((i) => state.ownership[i].owner === id).length;
        return owned ? (
          <span key={g} className="gdot plain">
            {g === 'airport' ? '✈️' : '⚡'}
            {owned}
          </span>
        ) : null;
      })}
    </div>
  );
}

export function PlayersPanel({
  state,
  me,
  onTrade,
}: {
  state: GameState;
  me: string | null;
  onTrade: (to: string) => void;
}) {
  const t = useT();
  const active = activePlayer(state);
  const canTrade = !!me && !getPlayer(state, me)?.bankrupt && state.phase !== 'over';
  const teams = isTeamGame(state);
  return (
    <div className="players">
      {teams && (
        <div className="team-summary">
          {[0, 1].map((team) => {
            const members = state.players.filter((p) => p.team === team);
            const worth = members.reduce((sum, p) => sum + netWorth(state, p.id), 0);
            const alive = members.filter((p) => !p.bankrupt).length;
            return (
              <div key={team} className="team-sum" style={{ ['--tc' as string]: TEAM_COLORS[team] }}>
                <b>
                  {TEAM_ICONS[team]} {t(TEAM_NAMES[team][0], TEAM_NAMES[team][1])}
                </b>
                <small className="muted">
                  ${worth} · {alive}/{members.length} {t('in gioco', 'alive')}
                </small>
              </div>
            );
          })}
        </div>
      )}
      {state.players.map((p) => {
        const debt = totalDebt(state, p.id);
        return (
          <div
            key={p.id}
            className={`player ${p.id === active.id && state.phase !== 'over' ? 'active' : ''} ${p.bankrupt ? 'out' : ''} ${p.team !== undefined && teams ? `team-${p.team}` : ''}`}
            style={{ ['--pc' as string]: p.color }}
          >
            <div className="player-token">{p.token}</div>
            <div className="player-main">
              <div className="player-name">
                <b>{p.name}</b>
                {p.id === me && <span className="you">{t('tu', 'you')}</span>}
                {teams && p.team !== undefined && p.id !== me && getPlayer(state, me)?.team === p.team && (
                  <span className="team-badge" style={{ ['--tc' as string]: TEAM_COLORS[p.team] }}>
                    {t('compagno', 'teammate')}
                  </span>
                )}
                {p.inJail && <span title={t('In prigione', 'In jail')}>🔒</span>}
                {p.jailCards.length > 0 && <span title={t('Carta esci di prigione', 'Get out of jail card')}>🎫{p.jailCards.length > 1 ? p.jailCards.length : ''}</span>}
              </div>
              {p.bankrupt ? (
                <small className="muted">{t('Bancarotta', 'Bankrupt')}</small>
              ) : (
                <>
                  <div className="player-cash">
                    <b>${p.cash}</b>
                    <CashDelta cash={p.cash} />
                    <small className="muted" title={t('Patrimonio netto', 'Net worth')}>
                      · ${netWorth(state, p.id)}
                    </small>
                  </div>
                  {debt > 0 && <small className="debt">{t('Debito', 'Debt')} ${debt}</small>}
                  <GroupDots state={state} id={p.id} />
                </>
              )}
            </div>
            {canTrade && p.id !== me && !p.bankrupt && (
              <button className="icon-btn" title={t(`Scambia con ${p.name}`, `Trade with ${p.name}`)} onClick={() => onTrade(p.id)}>
                🤝
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- trades

function describeSide(state: GameState, props: number[], cash: number, cards: number, lang: Lang) {
  const parts = props.map((i) => (
    <span key={i} className="chip" style={{ ['--group' as string]: GROUP_COLORS[BOARD[i].group!] }}>
      {shortOf(state.theme, i, lang)}
    </span>
  ));
  if (cash) parts.push(<span key="c" className="chip cash">${cash}</span>);
  if (cards) parts.push(<span key="j" className="chip">🎫×{cards}</span>);
  if (!parts.length) parts.push(<span key="n" className="muted small">{lang === 'en' ? 'nothing' : 'niente'}</span>);
  return parts;
}

export function TradesPanel({
  state,
  me,
  act,
  onCounter,
}: {
  state: GameState;
  me: string | null;
  act: (a: Action) => void;
  onCounter: (t: TradeOffer) => void;
}) {
  const tt = useT();
  const lang = useLang();
  const trades = state.trades.filter((t) => !me || t.from === me || t.to === me);
  if (!trades.length) return null;
  return (
    <div className="trades">
      <h4>{tt('Scambi', 'Trades')}</h4>
      {trades.map((t) => {
        const from = getPlayer(state, t.from)!;
        const to = getPlayer(state, t.to)!;
        return (
          <div key={t.id} className={`trade ${t.to === me ? 'incoming' : ''}`}>
            <div className="trade-head">
              <b style={{ color: from.color }}>{from.name}</b> → <b style={{ color: to.color }}>{to.name}</b>
            </div>
            <div className="trade-line">
              <small className="muted">{tt('dà', 'gives')}</small> {describeSide(state, t.giveProps, t.giveCash, t.giveCards, lang)}
            </div>
            <div className="trade-line">
              <small className="muted">{tt('chiede', 'wants')}</small> {describeSide(state, t.getProps, t.getCash, t.getCards, lang)}
            </div>
            <div className="trade-btns">
              {t.to === me && (
                <>
                  <button className="btn small primary" onClick={() => act({ type: 'acceptTrade', id: t.id })}>
                    {tt('Accetta', 'Accept')}
                  </button>
                  <button className="btn small" onClick={() => onCounter(t)}>
                    {tt('Controproposta', 'Counter')}
                  </button>
                  <button className="btn small ghost" onClick={() => act({ type: 'rejectTrade', id: t.id })}>
                    {tt('Rifiuta', 'Reject')}
                  </button>
                </>
              )}
              {t.from === me && (
                <button className="btn small ghost" onClick={() => act({ type: 'cancelTrade', id: t.id })}>
                  {tt('Ritira', 'Withdraw')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- log

export function LogPanel({ log }: { log: LogEntry[] }) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [log.length, log[log.length - 1]?.id]);
  return (
    <div className="log" ref={ref}>
      {log.map((l) => (
        <div key={l.id} className={`log-entry k-${l.kind}`}>
          {logText(l, lang)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- my properties

export function MyProps({ state, me, onOpen }: { state: GameState; me: string; onOpen: (i: number) => void }) {
  const t = useT();
  const lang = useLang();
  const props = propertiesOf(state, me);
  if (!props.length) return <p className="muted small pad">{t('Non possiedi ancora nessuna proprietà.', 'You don’t own any property yet.')}</p>;
  return (
    <div className="my-props">
      {props.map((i) => {
        const sp = spaceOf(state.theme, i, lang);
        const own = state.ownership[i];
        return (
          <button key={i} className={`my-prop ${own.mortgaged ? 'mortgaged' : ''}`} style={{ ['--group' as string]: GROUP_COLORS[sp.group!] }} onClick={() => onOpen(i)}>
            <i className="pick-color" />
            <span>{sp.name}</span>
            <small>
              {own.mortgaged ? t('ipotecata', 'mortgaged') : own.houses === 5 ? '🏨' : own.houses ? '🏠'.repeat(own.houses) : ''}
            </small>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- center widgets

export function TimerBar({ deadline, total, now }: { deadline: number | null; total: number; now: number }) {
  if (!deadline || !total) return null;
  const left = Math.max(0, deadline - now);
  const pct = Math.min(100, (left / total) * 100);
  return (
    <div className={`timer ${pct < 25 ? 'low' : ''}`}>
      <div style={{ width: `${pct}%` }} />
      <span>{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

export function CardView({ card, state }: { card: DrawnCard; state: GameState }) {
  const lang = useLang();
  const c = cardsOf(card.deck)[card.card];
  const who = getPlayer(state, card.playerId);
  return (
    <div className={`game-card deck-${card.deck}`}>
      <small>{DECK_ICONS[card.deck]} {deckName(card.deck, lang)}</small>
      <p>{cardText(state.theme, lang === 'en' ? c.en : c.text, lang)}</p>
      {who && (
        <small className="muted">
          {who.token} {who.name}
        </small>
      )}
    </div>
  );
}

export function AuctionPanel({
  state,
  me,
  act,
  now,
}: {
  state: GameState;
  me: string | null;
  act: (a: Action) => void;
  now: number;
}) {
  const t = useT();
  const lang = useLang();
  const a = state.auction!;
  const sp = spaceOf(state.theme, a.space, lang);
  const meP = me ? getPlayer(state, me) : undefined;
  const bidder = getPlayer(state, a.highBidder);
  const [custom, setCustom] = useState('');
  const left = Math.max(0, a.endsAt - now);
  const canBid = (v: number) => !!meP && !meP.bankrupt && v > a.highBid && v <= meP.cash && a.highBidder !== me && !debtsOf(state, me!).length;
  return (
    <div className="auction" style={{ ['--group' as string]: sp.group ? GROUP_COLORS[sp.group] : '#888' }}>
      <div className="auction-head">
        <small>🔨 {t('ASTA', 'AUCTION')}</small>
        <b>
          {sp.icon} {sp.name}
        </b>
        <small className="muted">{t('valore', 'value')} ${sp.price}</small>
      </div>
      <div className="auction-bid">
        <span className="big-num">${a.highBid}</span>
        <span>{bidder ? <b style={{ color: bidder.color }}>{bidder.token} {bidder.name}</b> : <span className="muted">{t('nessuna offerta', 'no bids')}</span>}</span>
      </div>
      <div className={`timer ${left < 3000 ? 'low' : ''}`}>
        <div style={{ width: `${Math.min(100, (left / (state.settings.auctionTime * 1000)) * 100)}%` }} />
        <span>{(left / 1000).toFixed(1)}s</span>
      </div>
      {meP && !meP.bankrupt && (
        <>
          <div className="bid-btns">
            {[1, 10, 50, 100].map((inc) => (
              <button key={inc} className="btn small" disabled={!canBid(a.highBid + inc)} onClick={() => act({ type: 'bid', amount: a.highBid + inc })}>
                +{inc}
              </button>
            ))}
          </div>
          <form
            className="bid-custom"
            onSubmit={(e) => {
              e.preventDefault();
              act({ type: 'bid', amount: +custom });
              setCustom('');
            }}
          >
            <input type="number" placeholder={`> ${a.highBid}`} value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn small primary" disabled={!canBid(+custom)}>
              {t('Offri', 'Bid')}
            </button>
          </form>
          <small className="muted">{t('Hai', 'You have')} ${meP.cash}</small>
        </>
      )}
    </div>
  );
}

export function ActionPanel({
  state,
  me,
  act,
  busy,
}: {
  state: GameState;
  me: string | null;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const active = activePlayer(state);
  const meP = me ? getPlayer(state, me) : undefined;
  if (!meP) return <div className="actions"><p className="muted">👀 {t('Stai guardando la partita', 'You are watching the game')}</p></div>;
  if (meP.bankrupt) return <div className="actions"><p className="muted">{t('Sei in bancarotta: puoi continuare a guardare.', 'You are bankrupt: you can keep watching.')}</p></div>;

  const myDebts = debtsOf(state, meP.id);
  if (myDebts.length) {
    const total = myDebts.reduce((s, d) => s + d.amount, 0);
    const canRaise = liquidationValue(state, meP.id) >= myDebts[0].amount;
    return (
      <div className="actions debt-box">
        <p>
          ⚠️ {t('Devi pagare', 'You must pay')} <b>${total}</b> ({myDebts.map((d) => (lang === 'en' ? d.reasonEn ?? d.reason : d.reason)).join(', ')}).
        </p>
        <small className="muted">
          {canRaise
            ? t('Ipoteca proprietà o vendi edifici dal pannello “Proprietà”, poi paga.', 'Mortgage properties or sell buildings from the “Properties” tab, then pay.')
            : t('Non puoi raccogliere abbastanza denaro.', 'You can’t raise enough money.')}
        </small>
        <div className="row">
          <button className="btn primary" disabled={busy || meP.cash < myDebts[0].amount} onClick={() => act({ type: 'payDebt' })}>
            {t('Paga', 'Pay')} ${myDebts[0].amount}
          </button>
          <button className="btn danger" disabled={busy} onClick={() => confirm(t('Dichiarare bancarotta?', 'Declare bankruptcy?')) && act({ type: 'bankrupt' })}>
            {t('Bancarotta', 'Bankruptcy')}
          </button>
        </div>
      </div>
    );
  }

  if (active.id !== meP.id) {
    return (
      <div className="actions">
        <p className="muted">
          {t('Turno di', 'Turn:')} <b style={{ color: active.color }}>{active.token} {active.name}</b>
          {state.phase === 'buy' && t(' · sta decidendo se comprare', ' · deciding whether to buy')}
        </p>
      </div>
    );
  }

  if (state.phase === 'roll') {
    return (
      <div className="actions">
        {meP.inJail && <p className="muted">🔒 {t('Sei in prigione', 'You are in jail')} ({t('tentativo', 'attempt')} {meP.jailTurns + 1}/3)</p>}
        <div className="row">
          <button className="btn primary big pulse" disabled={busy} onClick={() => act({ type: 'roll' })}>
            🎲 {meP.inJail ? t('Tenta il doppio', 'Try for a double') : t('Tira i dadi', 'Roll the dice')}
          </button>
        </div>
        {meP.inJail && (
          <div className="row">
            <button className="btn small" disabled={busy || meP.cash < JAIL_FINE} onClick={() => act({ type: 'payJail' })}>
              {t('Paga', 'Pay')} ${JAIL_FINE}
            </button>
            {meP.jailCards.length > 0 && (
              <button className="btn small" disabled={busy} onClick={() => act({ type: 'useJailCard' })}>
                🎫 {t('Usa carta', 'Use card')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (state.phase === 'buy') {
    const sp = spaceOf(state.theme, meP.position, lang);
    return (
      <div className="actions buy-box" style={{ ['--group' as string]: sp.group ? GROUP_COLORS[sp.group] : '#888' }}>
        <p>
          {t('Comprare', 'Buy')} <b>{sp.icon} {sp.name}</b> {t('per', 'for')} <b>${sp.price}</b>?
        </p>
        <div className="row">
          <button className="btn primary" disabled={busy || meP.cash < sp.price!} onClick={() => act({ type: 'buy' })}>
            {t('Compra', 'Buy')} ${sp.price}
          </button>
          <button className="btn" disabled={busy} onClick={() => act({ type: 'decline' })}>
            {state.settings.auctions ? `🔨 ${t('Metti all’asta', 'Auction it')}` : t('Non comprare', 'Don’t buy')}
          </button>
        </div>
        {meP.cash < sp.price! && <small className="muted">{t('Contanti insufficienti: ipoteca qualcosa per comprare.', 'Not enough cash: mortgage something to buy it.')}</small>}
      </div>
    );
  }

  if (state.phase === 'end') {
    return (
      <div className="actions">
        <p className="muted small">{t('Puoi costruire, ipotecare o proporre scambi prima di passare.', 'You can build, mortgage or propose trades before ending your turn.')}</p>
        <div className="row">
          <button className="btn primary big" disabled={busy} onClick={() => act({ type: 'endTurn' })}>
            {t('Fine turno', 'End turn')} ➜
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------- end of game

export function WinnerModal({
  state,
  onExit,
  onRematch,
  canRematch,
}: {
  state: GameState;
  onExit: () => void;
  onRematch?: () => void;
  canRematch: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const ranking = [...state.players].sort((a: Player, b: Player) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    if (!a.bankrupt) return netWorth(state, b.id) - netWorth(state, a.id);
    return (b.bankruptOrder ?? 0) - (a.bankruptOrder ?? 0);
  });
  const winner = getPlayer(state, state.winner);
  const team = isTeamGame(state) && state.winnerTeam != null ? state.winnerTeam : null;
  return (
    <Modal title={t('Partita finita', 'Game over')} onClose={() => setOpen(false)}>
      <div className="winner">
        <div className="trophy">🏆</div>
        {team !== null ? (
          <h2 style={{ color: TEAM_COLORS[team] }}>
            {TEAM_ICONS[team]} {t(`Vince la ${TEAM_NAMES[team][0]}!`, `The ${TEAM_NAMES[team][1]} wins!`)}
          </h2>
        ) : (
          <h2 style={{ color: winner?.color }}>
            {winner?.token} {winner?.name} {t('vince!', 'wins!')}
          </h2>
        )}
        <p className="muted">
          {state.round} {t('giri', 'rounds')} · {Math.round((Date.now() - state.startedAt) / 60000)} {t('minuti', 'minutes')}
        </p>
        <ol className="ranking">
          {ranking.map((p, i) => (
            <li key={p.id}>
              <span className="rank">{i + 1}</span>
              <span>
                {p.token} {p.name}
              </span>
              <span className="muted">{p.bankrupt ? t('bancarotta', 'bankrupt') : `$${netWorth(state, p.id)}`}</span>
            </li>
          ))}
        </ol>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onExit}>
            {t('Torna alla lobby', 'Back to lobby')}
          </button>
          {canRematch && onRematch && (
            <button className="btn primary" onClick={onRematch}>
              🔁 {t('Rivincita', 'Rematch')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
