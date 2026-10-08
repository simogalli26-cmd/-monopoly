import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, PLAYER_COLORS, PLAYER_TOKENS } from '../../shared/board';
import type { Profile, RoomSummary } from '../../shared/protocol';
import type { BotLevel, Settings } from '../../shared/types';
import { getSocket, request } from '../net';
import { loadPref, savePref } from '../profile';
import { Modal } from './Modal';
import { SettingsForm } from './SettingsForm';
import { toast } from './Toasts';

export interface OfflineConfig {
  bots: number;
  level: BotLevel;
  settings: Settings;
}

interface Props {
  profile: Profile;
  setProfile: (p: Profile) => void;
  pendingRoom?: string;
  onJoin: (roomId: string) => void;
  onOffline: (cfg: OfflineConfig) => void;
}

const loadSettings = (): Settings => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(loadPref('settings', '{}')) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export function Home({ profile, setProfile, pendingRoom, onJoin, onOffline }: Props) {
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

  useEffect(() => {
    const s = getSocket();
    const onRooms = (list: RoomSummary[]) => setRooms(list);
    const onConnect = () => {
      setConnected(true);
      request<RoomSummary[]>('lobby:list').then((r) => r.ok && setRooms(r.data ?? []));
    };
    const onDisconnect = () => setConnected(false);
    s.on('lobby:rooms', onRooms);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) onConnect();
    return () => {
      s.off('lobby:rooms', onRooms);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    savePref('settings', JSON.stringify(s));
  };

  const needName = () => {
    if (profile.name.trim()) return false;
    toast('Scegli prima un nickname', 'error');
    document.getElementById('nick')?.focus();
    return true;
  };

  const create = async () => {
    if (needName()) return;
    const res = await request<string>('room:create', { name: roomName, isPrivate, settings, profile });
    if (!res.ok) return toast(res.error ?? 'Impossibile creare la stanza', 'error');
    setModal(null);
    onJoin(res.data!);
  };

  const join = (id: string) => {
    if (needName()) return;
    if (!id.trim()) return;
    onJoin(id.trim().toUpperCase());
  };

  const quickPlay = () => {
    if (needName()) return;
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
        <div className={`conn ${connected ? 'on' : 'off'}`}>
          <i /> {connected ? 'Online' : 'Offline'}
        </div>
      </header>

      <main className="home-grid">
        <section className="card hero">
          <h1>
            Compra. Costruisci. <span className="grad">Domina il mondo.</span>
          </h1>
          <p className="muted">
            Il classico gioco delle proprietà, reinventato: partite online con gli amici, bot intelligenti, aste in tempo
            reale e scambi avanzati.
          </p>

          <div className="profile">
            <label className="field grow">
              <span>Il tuo nickname</span>
              <input
                id="nick"
                maxLength={18}
                placeholder="Es. Tycoon"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </label>
            <div className="field">
              <span>Pedina</span>
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
              <span>Colore</span>
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
              ⚡ Gioco rapido
            </button>
            <button className="btn big" onClick={() => !needName() && setModal('create')} disabled={!connected}>
              ＋ Crea stanza
            </button>
            <button className="btn big ghost" onClick={() => !needName() && setModal('offline')}>
              🤖 Contro i bot
            </button>
          </div>
          <form
            className="join-code"
            onSubmit={(e) => {
              e.preventDefault();
              join(code);
            }}
          >
            <input placeholder="Codice stanza" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn" disabled={!connected || !code}>
              Entra
            </button>
          </form>
        </section>

        <section className="card rooms">
          <div className="rooms-head">
            <h2>Stanze pubbliche</h2>
            <div className="seg">
              <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                Tutte
              </button>
              <button className={filter === 'waiting' ? 'on' : ''} onClick={() => setFilter('waiting')}>
                In attesa
              </button>
            </div>
          </div>
          {!connected && <p className="muted empty">Connessione al server… Puoi comunque giocare contro i bot.</p>}
          {connected && visible.length === 0 && (
            <div className="empty">
              <div className="empty-icon">🏙️</div>
              <p className="muted">Nessuna stanza aperta. Creane una e invita i tuoi amici!</p>
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
                  <span className={`badge ${r.status}`}>{r.status === 'waiting' ? 'In attesa' : 'In corso'}</span>
                  <span className="muted">
                    {r.players}/{r.maxPlayers}
                  </span>
                  <button className="btn small" onClick={() => join(r.id)}>
                    {r.status === 'waiting' && r.players < r.maxPlayers ? 'Entra' : 'Guarda'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card features">
          <h2>Cosa c'è di nuovo</h2>
          <ul>
            <li>🧠 <b>Bot con 3 livelli</b> che comprano, costruiscono, fanno aste e propongono scambi</li>
            <li>🔨 <b>Aste in tempo reale</b> con timer che si estende ad ogni offerta</li>
            <li>🤝 <b>Scambi completi</b>: proprietà, contanti e carte “esci di prigione”, con controproposte</li>
            <li>💳 <b>Gestione dei debiti</b>: ipoteca o vendi prima di finire in bancarotta</li>
            <li>⏱️ <b>Timer di turno</b> e pilota automatico per chi si disconnette</li>
            <li>📈 <b>Patrimonio netto</b> in tempo reale e classifica finale</li>
            <li>🏪 <b>Costruisci un impero di attività</b>: dal chiosco di hot dog al cinema, dall’elettronica al laboratorio AI</li>
          </ul>
        </section>
      </main>

      {modal === 'create' && (
        <Modal title="Crea una stanza" onClose={() => setModal(null)}>
          <label className="field">
            <span>Nome della stanza</span>
            <input value={roomName} maxLength={32} placeholder={`Stanza di ${profile.name || '…'}`} onChange={(e) => setRoomName(e.target.value)} />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
            <span className="switch" aria-hidden />
            <span className="toggle-text">
              <b>Stanza privata</b>
              <small>Non compare nella lista: si entra solo con il link o il codice.</small>
            </span>
          </label>
          <SettingsForm value={settings} onChange={updateSettings} />
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setModal(null)}>
              Annulla
            </button>
            <button className="btn primary" onClick={create}>
              Crea stanza
            </button>
          </div>
        </Modal>
      )}

      {modal === 'offline' && (
        <Modal title="Partita contro i bot" onClose={() => setModal(null)}>
          <div className="settings-grid">
            <label className="field">
              <span>Avversari</span>
              <select value={bots} onChange={(e) => setBots(+e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Difficoltà</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
                <option value="easy">Facile</option>
                <option value="normal">Media</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
          </div>
          <SettingsForm value={settings} onChange={updateSettings} compact />
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setModal(null)}>
              Annulla
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setModal(null);
                onOffline({ bots, level, settings: { ...settings, maxPlayers: 8 } });
              }}
            >
              Gioca
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
