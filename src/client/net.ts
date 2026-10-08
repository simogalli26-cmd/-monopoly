import { io, type Socket } from 'socket.io-client';
import type { Ack } from '../shared/protocol';
import { getClientId } from './profile';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.VITE_SERVER_URL as string | undefined;
    socket = io(url ?? '/', { transports: ['websocket', 'polling'] });
    const hello = () => socket!.emit('hello', { clientId: getClientId() });
    socket.on('connect', hello);
  }
  return socket;
}

export function request<T = unknown>(event: string, payload?: unknown): Promise<Ack<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'Server non raggiungibile' }), 8000);
    const done = (res: Ack<T>) => {
      clearTimeout(timer);
      resolve(res ?? { ok: false });
    };
    if (payload === undefined) s.emit(event, done);
    else s.emit(event, payload, done);
  });
}
