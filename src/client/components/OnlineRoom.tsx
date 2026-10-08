import { useCallback, useEffect, useState } from 'react';
import type { Ack, ChatMessage, Profile, RoomView } from '../../shared/protocol';
import type { Action, GameState } from '../../shared/types';
import { getSocket, request } from '../net';
import { getClientId } from '../profile';
import { sfx } from '../sound';
import { Game } from './Game';
import { RoomLobby } from './RoomLobby';
import { toast } from './Toasts';

interface Props {
  roomId: string;
  profile: Profile;
  onExit: () => void;
}

export function OnlineRoom({ roomId, profile, onExit }: Props) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const me = getClientId();

  useEffect(() => {
    const s = getSocket();
    const join = async () => {
      const res = await request('room:join', { roomId, profile });
      if (!res.ok) setError(res.error ?? 'Impossibile entrare');
    };
    const onRoom = (r: RoomView) => setRoom(r);
    const onGame = (g: GameState | null) => setGame(g);
    const onHistory = (msgs: ChatMessage[]) => setChat(msgs);
    const onMsg = (m: ChatMessage) => {
      setChat((xs) => [...xs.slice(-99), m]);
      if (m.from !== me && !m.system) sfx.chat();
    };
    const onKicked = (id: string) => {
      if (id === me) {
        toast('Sei stato rimosso dalla stanza', 'error');
        onExit();
      }
    };
    s.on('room:update', onRoom);
    s.on('game:state', onGame);
    s.on('chat:history', onHistory);
    s.on('chat:msg', onMsg);
    s.on('room:kicked', onKicked);
    s.on('connect', join);
    if (s.connected) join();
    return () => {
      s.off('room:update', onRoom);
      s.off('game:state', onGame);
      s.off('chat:history', onHistory);
      s.off('chat:msg', onMsg);
      s.off('room:kicked', onKicked);
      s.off('connect', join);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const leave = useCallback(async () => {
    await request('room:leave');
    onExit();
  }, [onExit]);

  const send = useCallback((a: Action) => request('game:action', a) as Promise<Ack>, []);
  const sendChat = useCallback((t: string) => getSocket().emit('chat:send', t), []);

  if (error)
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h2>Ops!</h2>
          <p className="muted">{error}</p>
          <button className="btn primary" onClick={onExit}>
            Torna alla lobby
          </button>
        </div>
      </div>
    );

  if (!room)
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">Entro nella stanza {roomId}…</p>
      </div>
    );

  if (!game || room.status === 'waiting')
    return <RoomLobby room={room} me={me} chat={chat} sendChat={sendChat} onLeave={leave} />;

  const isPlayer = game.players.some((p) => p.id === me);
  return (
    <Game
      state={game}
      me={isPlayer ? me : null}
      send={send}
      chat={{ messages: chat, send: sendChat }}
      onExit={leave}
      isHost={room.hostId === me}
      onRematch={() => request('room:rematch')}
      roomId={room.id}
    />
  );
}
