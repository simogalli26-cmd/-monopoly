import type { BotLevel, PlayerSeat, Settings } from './types';

export interface Profile {
  name: string;
  color: string;
  token: string;
}

export interface RoomSeat extends PlayerSeat {
  connected: boolean;
}

export interface RoomView {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  settings: Settings;
  seats: RoomSeat[];
  status: 'waiting' | 'playing' | 'finished';
}

export interface RoomSummary {
  id: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
  status: RoomView['status'];
  startingCash: number;
  tokens: string[];
}

export interface ChatMessage {
  id: number;
  from: string;
  name: string;
  color: string;
  text: string;
  at: number;
  system?: boolean;
}

export interface Ack<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface CreateRoomPayload {
  name: string;
  isPrivate: boolean;
  settings: Settings;
  profile: Profile;
}

export type AddBotPayload = { level: BotLevel };
