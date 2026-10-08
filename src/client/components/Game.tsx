import { useCallback, useEffect, useRef, useState } from 'react';
import { activePlayer, getPlayer } from '../../shared/engine';
import type { Ack, ChatMessage } from '../../shared/protocol';
import type { Action, DrawnCard, GameState, TradeDraft, TradeOffer } from '../../shared/types';
import { isSoundOn, setSound, sfx } from '../sound';
import { Board } from './Board';
import { ChatPanel } from './ChatPanel';
import { Dice } from './Dice';
import { Modal } from './Modal';
import { ActionPanel, AuctionPanel, CardView, LogPanel, MyProps, PlayersPanel, TimerBar, TradesPanel, WinnerModal } from './Panels';
import { PropertyCard } from './PropertyCard';
import { toast } from './Toasts';
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

/** Moves tokens one tile at a time towards their real positions. */
function useTokenAnimation(state: GameState) {
  const [positions, setPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.players.map((p) => [p.id, p.position])),
  );
  const [moving, setMoving] = useState<string | null>(null);
  const current = useRef(positions);
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const key = state.players.map((p) => `${p.id}:${p.position}:${p.inJail}`).join('|');

  useEffect(() => {
    for (const p of state.players) {
      const from = current.current[p.id] ?? p.position;
      const to = p.position;
      if (from === to) continue;
      const prev = timers.current.get(p.id);
      if (prev) clearInterval(prev);
      const fwd = (to - from + 40) % 40;
      const set = (v: number) => {
        current.current = { ...current.current, [p.id]: v };
        setPositions(current.current);
      };
      if ((p.inJail && to === 10) || fwd === 0) {
        set(to);
        continue;
      }
      const backwards = fwd >= 37;
      const steps = backwards ? 40 - fwd : fwd;
      const speed = steps > 12 ? 55 : 125;
      let done = 0;
      setMoving(p.id);
      const t = setInterval(() => {
        done++;
        const v = (from + (backwards ? -done : done) + 40) % 40;
        set(v);
        sfx.step();
        if (done >= steps) {
          clearInterval(t);
          timers.current.delete(p.id);
          setMoving((m) => (m === p.id ? null : m));
        }
      }, speed);
      timers.current.set(p.id, t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => timers.current.forEach((t) => clearInterval(t)), []);
  return { positions, moving };
}

function useGameSounds(state: GameState, me: string | null) {
  const prev = useRef<GameState | null>(null);
  useEffect(() => {
    const old = prev.current;
    prev.current = state;
    if (!old || old.id !== state.id) return;
    if (state.rollSeq !== old.rollSeq) sfx.dice();
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
  const { positions, moving } = useTokenAnimation(state);
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
  useGameSounds(state, me);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const c = state.lastCard;
    if (!c || c.seq === lastCardSeq.current) return;
    lastCardSeq.current = c.seq;
    setCard(c);
    const t = setTimeout(() => setCard((x) => (x?.seq === c.seq ? null : x)), 4200);
    return () => clearTimeout(t);
  }, [state.lastCard]);

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
        toast(res.error ?? 'Azione non valida', 'error');
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
      toast('Proposta inviata', 'success');
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

  const active = activePlayer(state);
  const meP = getPlayer(state, me);
  const myTurn = !!meP && active.id === me;
  const exit = () => {
    if (state.phase !== 'over' && meP && !meP.bankrupt && !offline) {
      if (!confirm('Uscire dalla partita? Verrai dichiarato in bancarotta.')) return;
    } else if (state.phase !== 'over' && offline && !confirm('Abbandonare la partita?')) return;
    onExit();
  };

  const center = (
    <div className="center-inner">
      <div className="brand">
        Metro<b>poly</b>
      </div>
      <div className="center-status">
        <span className="round">Giro {state.round}</span>
        {state.settings.freeParkingPot && <span className="pot-badge">🅿️ Montepremi ${state.pot}</span>}
      </div>
      <Dice dice={state.dice} seq={state.rollSeq} />
      {card && <CardView card={card} state={state} />}
      {state.phase === 'auction' && state.auction ? (
        <AuctionPanel state={state} me={me} act={act} now={now} />
      ) : state.phase === 'over' ? (
        <div className="actions">
          <p>🏆 Partita terminata</p>
        </div>
      ) : (
        <ActionPanel state={state} me={me} act={act} busy={busy || !!moving} />
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
          {state.phase === 'over' ? 'Fine partita' : myTurn ? '⭐ Tocca a te!' : `Turno di ${active.token} ${active.name}`}
        </div>
        <div className="header-actions">
          {roomId && (
            <span className="muted small hide-sm">
              Stanza <code>{roomId}</code>
            </span>
          )}
          <button
            className="icon-btn"
            title="Audio"
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
            }}
          >
            {sound ? '🔊' : '🔇'}
          </button>
          <button className="btn small ghost" onClick={exit}>
            Esci
          </button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="side left">
          <PlayersPanel state={state} me={me} onTrade={(to) => setTrade({ to })} />
          <TradesPanel state={state} me={me} act={act} onCounter={counter} />
          {meP && !meP.bankrupt && state.phase !== 'over' && (
            <button className="btn wide" onClick={() => setTrade({})}>
              🤝 Nuovo scambio
            </button>
          )}
        </aside>

        <main className="board-area">
          <Board
            state={state}
            positions={positions}
            highlight={moving ? null : state.phase === 'buy' ? active.position : state.auction?.space ?? null}
            onTile={setSelected}
            center={center}
            movingId={moving}
          />
        </main>

        <aside className="side right">
          <div className="tabs">
            <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
              Registro
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
                Proprietà
              </button>
            )}
          </div>
          <div className="tab-body">
            {tab === 'log' && <LogPanel log={state.log} />}
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

      {state.phase === 'over' && (
        <WinnerModal state={state} onExit={onExit} onRematch={onRematch} canRematch={!!isHost} />
      )}
    </div>
  );
}
