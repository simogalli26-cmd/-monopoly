import { useCallback, useEffect, useRef, useState } from 'react';
import { TEAM_ICONS, activePlayer, getPlayer, isTeamGame } from '../../shared/engine';
import type { Ack, ChatMessage } from '../../shared/protocol';
import { DICE_MS, moveDuration, stepMs, walkSteps } from '../../shared/timing';
import type { Action, DrawnCard, GameState, TradeDraft, TradeOffer } from '../../shared/types';
import { adBreak, gameplayStart, gameplayStop, happyTime } from '../platform';
import { isSoundOn, setSound, sfx } from '../sound';
import { Board } from './Board';
import { ChatPanel } from './ChatPanel';
import { Dice } from './Dice';
import { Modal } from './Modal';
import { ActionPanel, AuctionPanel, CardView, LogPanel, MyProps, PlayersPanel, TimerBar, TradesPanel, WinnerModal } from './Panels';
import { PropertyCard } from './PropertyCard';
import { toast } from './Toasts';
import { LangToggle } from './LangToggle';
import { msg, useT } from '../i18n';
import { TradeModal } from './TradeModal';

interface Props {
  state: GameState;
  me: string | null;
  send: (a: Action) => Promise<Ack>;
  chat?: { messages: ChatMessage[]; send: (t: string) => void };
  onExit: () => void;
  isHost?: boolean;
  onRematch?: () => void;
  offline?: boolean;
  roomId?: string;
}

/** Moves tokens one tile at a time towards their real positions, after the dice have landed. */
function useTokenAnimation(state: GameState) {
  const [positions, setPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.players.map((p) => [p.id, p.position])),
  );
  const [moving, setMoving] = useState<string | null>(null);
  const current = useRef(positions);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastRoll = useRef(state.rollSeq);
  const key = state.players.map((p) => `${p.id}:${p.position}:${p.inJail}`).join('|');

  useEffect(() => {
    const rolled = state.rollSeq !== lastRoll.current;
    lastRoll.current = state.rollSeq;
    for (const p of state.players) {
      const from = current.current[p.id] ?? p.position;
      const to = p.position;
      if (from === to) continue;
      const prev = timers.current.get(p.id);
      if (prev) clearTimeout(prev);
      const set = (v: number) => {
        current.current = { ...current.current, [p.id]: v };
        setPositions(current.current);
      };
      const steps = walkSteps(from, to, p.inJail);
      const backwards = (to - from + 40) % 40 >= 37;
      const speed = stepMs(steps);
      let done = 0;
      const step = () => {
        if (steps === 0) {
          set(to);
          timers.current.delete(p.id);
          return;
        }
        done++;
        set((from + (backwards ? -done : done) + 40) % 40);
        sfx.step();
        if (done >= steps) {
          timers.current.delete(p.id);
          setMoving((m) => (m === p.id ? null : m));
        } else timers.current.set(p.id, setTimeout(step, speed));
      };
      if (steps > 0) setMoving(p.id);
      timers.current.set(p.id, setTimeout(step, rolled ? DICE_MS : 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  return { positions, moving };
}

/**
 * The state the viewer "sees": after a roll it lags behind the real state until the dice
 * and the token animation are over, so money, log and cards don't spoil the result.
 */
function useFollowView(state: GameState): [GameState, boolean] {
  const [view, setView] = useState(state);
  const prevRef = useRef(state);
  const releaseAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    const now = Date.now();
    const d = prev.id === state.id ? moveDuration(prev, state) : 0;
    releaseAt.current = Math.max(releaseAt.current, now + d);
    clearTimeout(timer.current);
    const wait = releaseAt.current - now;
    if (wait <= 0) setView(state);
    else timer.current = setTimeout(() => setView(state), wait);
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [view, view !== state];
}

function useGameSounds(state: GameState, me: string | null) {
  const prev = useRef<GameState | null>(null);
  useEffect(() => {
    const old = prev.current;
    prev.current = state;
    if (!old || old.id !== state.id) return;
    if (state.phase === 'over' && old.phase !== 'over') return sfx.win();
    const turnChanged = activePlayer(state).id !== activePlayer(old).id;
    if (turnChanged && activePlayer(state).id === me) sfx.turn();
    const lastOld = old.log[old.log.length - 1]?.id ?? 0;
    const fresh = state.log.filter((l) => l.id > lastOld);
    const kinds = new Set(fresh.map((l) => l.kind));
    if (kinds.has('jail')) sfx.jail();
    else if (kinds.has('build')) sfx.build();
    else if (kinds.has('buy') && state.phase === 'auction') sfx.bid();
    else if (kinds.has('buy')) sfx.cash();
    else if (kinds.has('card')) sfx.card();
    else if (kinds.has('trade')) sfx.card();
    const meOld = getPlayer(old, me);
    const meNew = getPlayer(state, me);
    if (meOld && meNew && meNew.cash < meOld.cash && !kinds.has('buy') && !kinds.has('build')) sfx.pay();
  }, [state, me]);
}

export function Game({ state, me, send, chat, onExit, isHost, onRematch, offline, roomId }: Props) {
  const t = useT();
  const { positions, moving } = useTokenAnimation(state);
  const [view, animating] = useFollowView(state);
  const [selected, setSelected] = useState<number | null>(null);
  const [trade, setTrade] = useState<Partial<TradeDraft> | null>(null);
  const [tab, setTab] = useState<'log' | 'chat' | 'props'>('log');
  const [card, setCard] = useState<DrawnCard | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [sound, setSoundState] = useState(isSoundOn());
  const [unread, setUnread] = useState(0);
  const lastCardSeq = useRef(state.lastCard?.seq ?? 0);
  const chatLen = useRef(chat?.messages.length ?? 0);
  useGameSounds(view, me);

  // Tell game portals when real gameplay is happening (used for their ad pacing).
  const over = view.phase === 'over';
  useEffect(() => {
    if (over) {
      gameplayStop();
      if (view.winner && view.winner === me) happyTime();
    } else gameplayStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);
  useEffect(() => () => void gameplayStop(), []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const c = view.lastCard;
    if (!c || c.seq === lastCardSeq.current) return;
    lastCardSeq.current = c.seq;
    setCard(c);
    const t = setTimeout(() => setCard((x) => (x?.seq === c.seq ? null : x)), 4200);
    return () => clearTimeout(t);
  }, [view.lastCard]);

  useEffect(() => {
    const n = chat?.messages.length ?? 0;
    if (n > chatLen.current && tab !== 'chat') setUnread((u) => u + n - chatLen.current);
    chatLen.current = n;
  }, [chat?.messages.length, tab]);

  const act = useCallback(
    async (a: Action) => {
      setBusy(true);
      const res = await send(a);
      setBusy(false);
      if (!res.ok) {
        sfx.error();
        toast(msg(res.error) || t('Azione non valida', 'Invalid action'), 'error');
      }
      return res;
    },
    [send],
  );

  // Keyboard shortcut: space = roll / end turn.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, textarea, select, button')) return;
      if (!me || activePlayer(state).id !== me) return;
      if (state.debts.some((d) => d.from === me)) return;
      e.preventDefault();
      if (state.phase === 'roll') act({ type: 'roll' });
      else if (state.phase === 'end') act({ type: 'endTurn' });
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [state, me, act]);

  const sendTrade = async (d: TradeDraft) => {
    const res = await act({ type: 'proposeTrade', offer: d });
    if (res.ok) {
      setTrade(null);
      toast(t('Proposta inviata', 'Offer sent'), 'success');
    }
  };

  const counter = (t: TradeOffer) =>
    setTrade({
      to: t.from,
      giveProps: t.getProps,
      getProps: t.giveProps,
      giveCash: t.getCash,
      getCash: t.giveCash,
      giveCards: t.getCards,
      getCards: t.giveCards,
    });

  const active = activePlayer(view);
  const meP = getPlayer(state, me);
  const myTurn = !!meP && active.id === me;
  const exit = () => {
    if (state.phase !== 'over' && meP && !meP.bankrupt && !offline) {
      if (!confirm(t('Uscire dalla partita? Verrai dichiarato in bancarotta.', 'Leave the game? You will be declared bankrupt.'))) return;
    } else if (state.phase !== 'over' && offline && !confirm(t('Abbandonare la partita?', 'Quit the game?'))) return;
    onExit();
  };

  const center = (
    <div className="center-inner">
      <div className="brand">
        Metro<b>poly</b>
      </div>
      <div className="center-status">
        <span className="round">{t('Giro', 'Round')} {view.round}</span>
        {view.settings.freeParkingPot && <span className="pot-badge">🛋️ {t('Montepremi', 'Jackpot')} ${view.pot}</span>}
      </div>
      <Dice dice={state.dice} seq={state.rollSeq} />
      {card && <CardView card={card} state={view} />}
      {state.phase === 'auction' && state.auction ? (
        <AuctionPanel state={state} me={me} act={act} now={now} />
      ) : view.phase === 'over' ? (
        <div className="actions">
          <p>🏆 {t('Partita terminata', 'Game over')}</p>
        </div>
      ) : (
        animating ? (
          <div className="actions">
            <p className="muted watching">
              {activePlayer(view).id === me
                ? t('🎲 Vediamo dove arrivi…', '🎲 Let’s see where you land…')
                : `${activePlayer(view).token} ${activePlayer(view).name} ${t('sta giocando…', 'is playing…')}`}
            </p>
          </div>
        ) : (
          <ActionPanel state={state} me={me} act={act} busy={busy || !!moving} />
        )
      )}
      {state.phase !== 'auction' && (
        <TimerBar deadline={state.turnDeadline} total={state.settings.turnTime * 1000} now={now} />
      )}
    </div>
  );

  return (
    <div className={`game ${myTurn ? 'my-turn' : ''}`}>
      <header className="game-header">
        <div className="logo small">
          <span className="logo-mark">M</span>
          <span>
            Metro<b>poly</b>
          </span>
        </div>
        <div className="turn-pill" style={{ ['--pc' as string]: active.color }}>
          {view.phase === 'over' ? t('Fine partita', 'Game over') : myTurn ? t('⭐ Tocca a te!', '⭐ Your turn!') : `${t('Turno di', 'Turn:')} ${active.team !== undefined && isTeamGame(view) ? TEAM_ICONS[active.team] + ' ' : ''}${active.token} ${active.name}`}
        </div>
        <div className="header-actions">
          {roomId && (
            <span className="muted small hide-sm">
              {t('Stanza', 'Room')} <code>{roomId}</code>
            </span>
          )}
          <LangToggle />
          <button
            className="icon-btn"
            title={t('Audio', 'Sound')}
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
            }}
          >
            {sound ? '🔊' : '🔇'}
          </button>
          <button className="btn small ghost" onClick={exit}>
            {t('Esci', 'Exit')}
          </button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="side left">
          <PlayersPanel state={view} me={me} onTrade={(to) => setTrade({ to })} />
          <TradesPanel state={state} me={me} act={act} onCounter={counter} />
          {meP && !meP.bankrupt && state.phase !== 'over' && (
            <button className="btn wide" onClick={() => setTrade({})}>
              🤝 {t('Nuovo scambio', 'New trade')}
            </button>
          )}
        </aside>

        <main className="board-area">
          <Board
            state={view}
            positions={positions}
            highlight={moving || animating ? null : view.phase === 'buy' ? activePlayer(view).position : view.auction?.space ?? null}
            onTile={setSelected}
            center={center}
            movingId={moving}
          />
        </main>

        <aside className="side right">
          <div className="tabs">
            <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
              {t('Registro', 'Log')}
            </button>
            {chat && (
              <button
                className={tab === 'chat' ? 'on' : ''}
                onClick={() => {
                  setTab('chat');
                  setUnread(0);
                }}
              >
                Chat {unread > 0 && <span className="dot-count">{unread}</span>}
              </button>
            )}
            {meP && (
              <button className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')}>
                {t('Proprietà', 'Properties')}
              </button>
            )}
          </div>
          <div className="tab-body">
            {tab === 'log' && <LogPanel log={view.log} />}
            {tab === 'chat' && chat && <ChatPanel messages={chat.messages} onSend={chat.send} me={me} />}
            {tab === 'props' && me && <MyProps state={state} me={me} onOpen={setSelected} />}
          </div>
        </aside>
      </div>

      {selected !== null && (
        <Modal onClose={() => setSelected(null)} className="card-modal">
          <PropertyCard
            state={state}
            index={selected}
            me={me}
            act={act}
            onTrade={(i) => {
              setSelected(null);
              setTrade({ to: state.ownership[i].owner!, getProps: [i] });
            }}
          />
        </Modal>
      )}

      {trade && me && (
        <TradeModal state={state} me={me} initial={trade} onSend={sendTrade} onClose={() => setTrade(null)} />
      )}

      {view.phase === 'over' && (
        <WinnerModal state={view} onExit={() => adBreak().then(onExit)} onRematch={onRematch} canRematch={!!isHost} />
      )}
    </div>
  );
}
