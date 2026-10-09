import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, PLAYER_COLORS, PLAYER_TOKENS } from '../../shared/board';
import type { Profile, RoomSummary } from '../../shared/protocol';
import type { BoardTheme } from '../../shared/theme';
import type { BotLevel, Settings } from '../../shared/types';
import { getBoard, listBoards } from '../boards';
import { businessMailto, useSiteConfig } from '../site';
import { Footer } from './Legal';
import { LangToggle } from './LangToggle';
import { msg, useT } from '../i18n';
import { isPortal } from '../platform';
import { getSocket, request } from '../net';
import { loadPref, savePref } from '../profile';
import { Modal } from './Modal';
import { SettingsForm } from './SettingsForm';
import { toast } from './Toasts';

export interface OfflineConfig {
  bots: number;
  level: BotLevel;
  settings: Settings;
  theme?: BoardTheme | null;
}

interface Props {
  profile: Profile;
  setProfile: (p: Profile) => void;
  pendingRoom?: string;
  onJoin: (roomId: string) => void;
  onOffline: (cfg: OfflineConfig) => void;
  onBoards: () => void;
  onNav: (route: string) => void;
}

const loadSettings = (): Settings => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(loadPref('settings', '{}')) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export function Home({ profile, setProfile, pendingRoom, onJoin, onOffline, onBoards, onNav }: Props) {
  const t = useT();
  const site = useSiteConfig();
  const [online, setOnline] = useState(0);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const [code, setCode] = useState(pendingRoom ?? '');
  const [modal, setModal] = useState<'create' | 'offline' | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [bots, setBots] = useState(3);
  const [level, setLevel] = useState<BotLevel>('normal');
  const [filter, setFilter] = useState<'all' | 'waiting'>('all');
  const [boardId, setBoardIdState] = useState(() => loadPref('boardId', ''));
  const boards = listBoards();
  const setBoardId = (id: string) => {
    setBoardIdState(id);
    savePref('boardId', id);
  };
  const boardPicker = (
    <label className="field">
      <span>{t('Tabellone', 'Board')}</span>
      <select value={getBoard(boardId) ? boardId : ''} onChange={(e) => setBoardId(e.target.value)}>
        <option value="">{t('Classico Metropoly', 'Classic Metropoly')}</option>
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            🎨 {b.title}
          </option>
        ))}
      </select>
    </label>
  );

  useEffect(() => {
    const s = getSocket();
    const onRooms = (list: RoomSummary[]) => setRooms(list);
    const onConnect = () => {
      setConnected(true);
      request<RoomSummary[]>('lobby:list').then((r) => r.ok && setRooms(r.data ?? []));
    };
    const onDisconnect = () => setConnected(false);
    s.on('lobby:rooms', onRooms);
    s.on('lobby:online', setOnline);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) onConnect();
    return () => {
      s.off('lobby:rooms', onRooms);
      s.off('lobby:online', setOnline);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    savePref('settings', JSON.stringify(s));
  };

  /** Players can start right away: an empty nickname gets a random one. */
  const ensureProfile = (): Profile => {
    if (profile.name.trim()) return profile;
    const p = { ...profile, name: `${t('Giocatore', 'Player')}${100 + Math.floor(Math.random() * 900)}` };
    setProfile(p);
    return p;
  };

  const create = async () => {
    const me = ensureProfile();
    const res = await request<string>('room:create', { name: roomName, isPrivate, settings, profile: me, theme: getBoard(boardId) });
    if (!res.ok) return toast(msg(res.error) || t('Impossibile creare la stanza', 'Unable to create the room'), 'error');
    setModal(null);
    onJoin(res.data!);
  };

  const join = (id: string) => {
    if (!id.trim()) return;
    ensureProfile();
    onJoin(id.trim().toUpperCase());
  };

  const quickPlay = () => {
    ensureProfile();
    const free = rooms.find((r) => r.status === 'waiting' && r.players < r.maxPlayers);
    if (free) return join(free.id);
    setModal('create');
  };

  const visible = rooms.filter((r) => filter === 'all' || r.status === 'waiting');

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo">
          <span className="logo-mark">M</span>
          <span>
            Metro<b>poly</b>
          </span>
        </div>
        <div className="header-actions">
          <div className={`conn ${connected ? 'on' : 'off'}`}>
            <i /> {connected ? (online > 1 ? t(`${online} giocatori online`, `${online} players online`) : 'Online') : 'Offline'}
          </div>
          <LangToggle />
        </div>
      </header>

      <main className="home-grid">
        <section className="card hero">
          <h1>
            {t('Compra. Costruisci.', 'Buy. Build.')} <span className="grad">{t('Domina il mondo.', 'Rule the world.')}</span>
          </h1>
          <p className="muted">
            {t(
              'Il classico gioco delle proprietà, reinventato: partite online con gli amici, bot intelligenti, aste in tempo reale e scambi avanzati.',
              'The classic property trading game, reinvented: online games with friends, smart bots, live auctions and advanced trades.',
            )}
          </p>

          <div className="profile">
            <label className="field grow">
              <span>{t('Il tuo nickname', 'Your nickname')}</span>
              <input
                id="nick"
                maxLength={18}
                placeholder={t('Es. Tycoon', 'e.g. Tycoon')}
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </label>
            <div className="field">
              <span>{t('Pedina', 'Token')}</span>
              <div className="token-picker">
                {PLAYER_TOKENS.map((t) => (
                  <button
                    key={t}
                    className={`token-opt ${profile.token === t ? 'sel' : ''}`}
                    onClick={() => setProfile({ ...profile, token: t })}
                    aria-label={`Pedina ${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>{t('Colore', 'Color')}</span>
              <div className="color-picker">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-opt ${profile.color === c ? 'sel' : ''}`}
                    style={{ background: c }}
                    onClick={() => setProfile({ ...profile, color: c })}
                    aria-label={`Colore ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="hero-actions">
            <button className="btn primary big" onClick={quickPlay} disabled={!connected}>
              ⚡ {t('Gioco rapido', 'Quick play')}
            </button>
            <button className="btn big" onClick={() => setModal('create')} disabled={!connected}>
              ＋ {t('Crea stanza', 'Create room')}
            </button>
            <button className="btn big ghost" onClick={() => setModal('offline')}>
              🤖 {t('Contro i bot', 'Play vs bots')}
            </button>
            <button className="btn big ghost" onClick={onBoards}>
              🎨 {t('Crea il tuo tabellone', 'Make your own board')}
            </button>
          </div>
          <form
            className="join-code"
            onSubmit={(e) => {
              e.preventDefault();
              join(code);
            }}
          >
            <input placeholder={t('Codice stanza', 'Room code')} value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn" disabled={!connected || !code}>
              {t('Entra', 'Join')}
            </button>
          </form>
        </section>

        <section className="card rooms">
          <div className="rooms-head">
            <h2>{t('Stanze pubbliche', 'Public rooms')}</h2>
            <div className="seg">
              <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                {t('Tutte', 'All')}
              </button>
              <button className={filter === 'waiting' ? 'on' : ''} onClick={() => setFilter('waiting')}>
                {t('In attesa', 'Waiting')}
              </button>
            </div>
          </div>
          {!connected && <p className="muted empty">{t('Connessione al server… Puoi comunque giocare contro i bot.', 'Connecting to the server… You can still play against bots.')}</p>}
          {connected && visible.length === 0 && (
            <div className="empty">
              <div className="empty-icon">🏙️</div>
              <p className="muted">{t('Nessuna stanza aperta. Creane una e invita i tuoi amici!', 'No open rooms. Create one and invite your friends!')}</p>
            </div>
          )}
          <ul className="room-list">
            {visible.map((r) => (
              <li key={r.id} className="room-item">
                <div className="room-info">
                  <b>{r.name}</b>
                  <small className="muted">
                    host {r.host} · ${r.startingCash} · <code>{r.id}</code>
                  </small>
                  <div className="room-tokens">{r.tokens.join(' ')}</div>
                </div>
                <div className="room-side">
                  <span className={`badge ${r.status}`}>{r.status === 'waiting' ? t('In attesa', 'Waiting') : t('In corso', 'Playing')}</span>
                  <span className="muted">
                    {r.players}/{r.maxPlayers}
                  </span>
                  <button className="btn small" onClick={() => join(r.id)}>
                    {r.status === 'waiting' && r.players < r.maxPlayers ? t('Entra', 'Join') : t('Guarda', 'Watch')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card business">
          <div>
            <h2>{t('🎨 Crea il tuo tabellone', '🎨 Make your own board')}</h2>
            <p className="muted">
              {t(
                'Feste, amici, ufficio, scuola: crea un Metropoly con i luoghi, le persone e le battute del tuo gruppo e condividilo con un link.',
                'Parties, friends, office, school: build a Metropoly with your group’s places, people and inside jokes, and share it with a link.',
              )}
            </p>
          </div>
          <div className="row">
            <button className="btn primary" onClick={onBoards}>
              🎨 {t('Apri l’editor', 'Open the editor')}
            </button>
            {!isPortal && site.contactEmail && (
              <a className="btn" href={businessMailto(site.contactEmail)}>
                ✉️ {t('Richiedi un tabellone su misura', 'Order a custom board')}
              </a>
            )}
            {!isPortal && site.supportUrl && (
              <a className="btn ghost" href={site.supportUrl} target="_blank" rel="noopener noreferrer">
                ❤️ {t('Supporta il gioco', 'Support the game')}
              </a>
            )}
          </div>
        </section>

        <section className="card features">
          <h2>{t('Cosa c’è di nuovo', 'What’s inside')}</h2>
          <ul>
            {[
              ['🧠', t('Bot con 3 livelli', '3 bot levels'), t('che comprano, costruiscono, fanno aste e propongono scambi', 'that buy, build, bid and propose trades')],
              ['🔨', t('Aste in tempo reale', 'Live auctions'), t('con timer che si estende ad ogni offerta', 'with a timer that extends on every bid')],
              ['🤝', t('Scambi completi', 'Full trades'), t('proprietà, contanti e carte “esci di prigione”, con controproposte', 'properties, cash and jail-free cards, with counter-offers')],
              ['💳', t('Gestione dei debiti', 'Debt handling'), t('ipoteca o vendi prima di finire in bancarotta', 'mortgage or sell before going bankrupt')],
              ['⏱️', t('Timer di turno', 'Turn timer'), t('e pilota automatico per chi si disconnette', 'and autopilot for disconnected players')],
              ['📈', t('Patrimonio netto', 'Net worth'), t('in tempo reale e classifica finale', 'live, plus final ranking')],
              ['🎨', t('Tabelloni personalizzati', 'Custom boards'), t('crea il tuo con l’editor e condividilo con un link', 'build yours in the editor and share it with a link')],
              ['🏪', t('Un impero di attività', 'A business empire'), t('dal chiosco di hot dog al cinema, fino al laboratorio AI', 'from the hot dog stand to the cinema and the AI lab')],
            ].map(([icon, title, desc]) => (
              <li key={icon}>
                {icon} <b>{title}</b> {desc}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer onNav={onNav} />

      {modal === 'create' && (
        <Modal title={t('Crea una stanza', 'Create a room')} onClose={() => setModal(null)}>
          <label className="field">
            <span>{t('Nome della stanza', 'Room name')}</span>
            <input value={roomName} maxLength={32} placeholder={t(`Stanza di ${profile.name || '…'}`, `${profile.name || '…'}’s room`)} onChange={(e) => setRoomName(e.target.value)} />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
            <span className="switch" aria-hidden />
            <span className="toggle-text">
              <b>{t('Stanza privata', 'Private room')}</b>
              <small>{t('Non compare nella lista: si entra solo con il link o il codice.', 'Not listed: players join only with the link or the code.')}</small>
            </span>
          </label>
          {boardPicker}
          <SettingsForm value={settings} onChange={updateSettings} />
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setModal(null)}>
              {t('Annulla', 'Cancel')}
            </button>
            <button className="btn primary" onClick={create}>
              {t('Crea stanza', 'Create room')}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'offline' && (
        <Modal title={t('Partita contro i bot', 'Game vs bots')} onClose={() => setModal(null)}>
          <div className="settings-grid">
            <label className="field">
              <span>{t('Avversari', 'Opponents')}</span>
              <select value={bots} onChange={(e) => setBots(+e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Difficoltà', 'Difficulty')}</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
                <option value="easy">{t('Facile', 'Easy')}</option>
                <option value="normal">{t('Media', 'Normal')}</option>
                <option value="hard">{t('Difficile', 'Hard')}</option>
              </select>
            </label>
          </div>
          {boardPicker}
          <SettingsForm value={settings} onChange={updateSettings} compact />
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setModal(null)}>
              {t('Annulla', 'Cancel')}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                ensureProfile();
                setModal(null);
                onOffline({ bots, level, settings: { ...settings, maxPlayers: 8 }, theme: getBoard(boardId) });
              }}
            >
              {t('Gioca', 'Play')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
