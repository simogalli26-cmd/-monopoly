import { useState } from 'react';
import { PLAYER_COLORS, PLAYER_TOKENS } from '../../shared/board';
import type { ChatMessage, RoomView } from '../../shared/protocol';
import type { BotLevel, Settings } from '../../shared/types';
import { getBoard, listBoards } from '../boards';
import { request } from '../net';
import { msg, useT } from '../i18n';
import { roomInviteLink } from '../platform';
import { BoardPreview } from './BoardEditor';
import { ChatPanel } from './ChatPanel';
import { SettingsForm } from './SettingsForm';
import { toast } from './Toasts';

interface Props {
  room: RoomView;
  me: string;
  chat: ChatMessage[];
  sendChat: (t: string) => void;
  onLeave: () => void;
}

const LEVEL: Record<BotLevel, [string, string]> = { easy: ['facile', 'easy'], normal: ['medio', 'normal'], hard: ['difficile', 'hard'] };

export function RoomLobby({ room, me, chat, sendChat, onLeave }: Props) {
  const t = useT();
  const isHost = room.hostId === me;
  const mySeat = room.seats.find((s) => s.id === me);
  const [botLevel, setBotLevel] = useState<BotLevel>('normal');
  const [showBoard, setShowBoard] = useState(false);
  const myBoards = listBoards();

  const call = async (event: string, payload?: unknown) => {
    const res = await request(event, payload);
    if (!res.ok && res.error) toast(msg(res.error), 'error');
  };

  const copy = async () => {
    const link = await roomInviteLink(room.id);
    try {
      await navigator.clipboard.writeText(link);
      toast(t('Link copiato! Invialo ai tuoi amici.', 'Link copied! Send it to your friends.'), 'success');
    } catch {
      toast(link);
    }
  };

  return (
    <div className="room-lobby">
      <header className="home-header">
        <button className="btn ghost" onClick={onLeave}>
          ← {t('Esci', 'Leave')}
        </button>
        <div className="room-title">
          <h1>{room.name}</h1>
          <span className="muted">
            {t('Codice', 'Code')} <code>{room.id}</code> {room.isPrivate && t('· 🔒 privata', '· 🔒 private')}
          </span>
        </div>
        <button className="btn" onClick={copy}>
          🔗 {t('Invita', 'Invite')}
        </button>
      </header>

      <main className="lobby-grid">
        <section className="card">
          <div className="rooms-head">
            <h2>
              {t('Giocatori', 'Players')} {room.seats.length}/{room.settings.maxPlayers}
            </h2>
            {isHost && (
              <div className="add-bot">
                <select value={botLevel} onChange={(e) => setBotLevel(e.target.value as BotLevel)}>
                  <option value="easy">{t('Bot facile', 'Easy bot')}</option>
                  <option value="normal">{t('Bot medio', 'Normal bot')}</option>
                  <option value="hard">{t('Bot difficile', 'Hard bot')}</option>
                </select>
                <button
                  className="btn small"
                  disabled={room.seats.length >= room.settings.maxPlayers}
                  onClick={() => call('room:addBot', { level: botLevel })}
                >
                  ＋ Bot
                </button>
              </div>
            )}
          </div>
          <ul className="seat-list">
            {room.seats.map((s) => (
              <li key={s.id} className="seat" style={{ ['--pc' as string]: s.color }}>
                <span className="seat-token">{s.token}</span>
                <span className="seat-name">
                  <b>{s.name}</b>
                  <small className="muted">
                    {s.id === room.hostId
                      ? '👑 Host'
                      : s.isBot
                        ? `Bot ${t(...LEVEL[s.botLevel ?? 'normal'])}`
                        : t('Giocatore', 'Player')}
                    {s.id === me && t(' · tu', ' · you')}
                    {!s.connected && t(' · disconnesso', ' · disconnected')}
                  </small>
                </span>
                {isHost && s.id !== me && (
                  <button className="icon-btn" onClick={() => call('room:kick', { id: s.id })} aria-label={t('Rimuovi', 'Remove')}>
                    ✕
                  </button>
                )}
              </li>
            ))}
            {Array.from({ length: Math.max(0, room.settings.maxPlayers - room.seats.length) }, (_, i) => (
              <li key={`empty${i}`} className="seat empty-seat">
                <span className="seat-token">·</span>
                <span className="muted">{t('Posto libero', 'Free seat')}</span>
              </li>
            ))}
          </ul>

          {mySeat && (
            <div className="my-look">
              <span className="muted">{t('Il tuo aspetto', 'Your look')}</span>
              <div className="token-picker">
                {PLAYER_TOKENS.map((t) => {
                  const taken = room.seats.some((s) => s.id !== me && s.token === t);
                  return (
                    <button
                      key={t}
                      disabled={taken}
                      className={`token-opt ${mySeat.token === t ? 'sel' : ''}`}
                      onClick={() => call('room:profile', { ...mySeat, token: t })}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="color-picker">
                {PLAYER_COLORS.map((c) => {
                  const taken = room.seats.some((s) => s.id !== me && s.color === c);
                  return (
                    <button
                      key={c}
                      disabled={taken}
                      className={`color-opt ${mySeat.color === c ? 'sel' : ''}`}
                      style={{ background: c }}
                      onClick={() => call('room:profile', { ...mySeat, color: c })}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="start-row">
            {isHost ? (
              <button className="btn primary big" disabled={room.seats.length < 2} onClick={() => call('room:start')}>
                ▶ {t('Inizia la partita', 'Start the game')}
              </button>
            ) : (
              <p className="muted">{t('In attesa che l’host avvii la partita…', 'Waiting for the host to start the game…')}</p>
            )}
            {isHost && room.seats.length < 2 && <small className="muted">{t('Servono almeno 2 giocatori: invita un amico o aggiungi un bot.', 'At least 2 players are needed: invite a friend or add a bot.')}</small>}
          </div>
        </section>

        <section className="card">
          <h2>
            {t('Regole', 'Rules')} {isHost ? '' : <small className="muted">{t('(decise dall’host)', '(set by the host)')}</small>}
          </h2>
          <div className="board-choice">
            <label className="field grow">
              <span>{t('Tabellone', 'Board')}</span>
              {isHost ? (
                <select value={room.theme?.id ?? ''} onChange={(e) => call('room:theme', getBoard(e.target.value))}>
                  <option value="">{t('Classico Metropoly', 'Classic Metropoly')}</option>
                  {room.theme && !myBoards.some((b) => b.id === room.theme!.id) && <option value={room.theme.id}>🎨 {room.theme.title}</option>}
                  {myBoards.map((b) => (
                    <option key={b.id} value={b.id}>
                      🎨 {b.title}
                    </option>
                  ))}
                </select>
              ) : (
                <b>{room.theme ? `🎨 ${room.theme.title}` : t('Classico Metropoly', 'Classic Metropoly')}</b>
              )}
            </label>
            <button className="btn small" onClick={() => setShowBoard(!showBoard)}>
              {showBoard ? t('Nascondi', 'Hide') : `👁️ ${t('Anteprima', 'Preview')}`}
            </button>
          </div>
          {showBoard && (
            <div className="lobby-preview">
              <BoardPreview theme={room.theme ?? { id: 'default', title: 'Classico Metropoly', spaces: {}, groups: {} }} />
            </div>
          )}
          <SettingsForm
            value={room.settings}
            onChange={isHost ? (s: Settings) => call('room:settings', s) : undefined}
          />
        </section>

        <section className="card chat-card">
          <h2>Chat</h2>
          <ChatPanel messages={chat} onSend={sendChat} me={me} />
        </section>
      </main>
    </div>
  );
}
