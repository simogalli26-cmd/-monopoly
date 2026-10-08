import { PLAYER_COLORS, PLAYER_TOKENS } from '../shared/board';
import type { Profile } from '../shared/protocol';

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export function getClientId(): string {
  let id = read('metropoly:clientId');
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    write('metropoly:clientId', id);
  }
  return id;
}

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(read('metropoly:profile') ?? 'null');
    if (p?.name) return p;
  } catch {
    /* ignore */
  }
  return {
    name: '',
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
    token: PLAYER_TOKENS[Math.floor(Math.random() * 6)],
  };
}

export const saveProfile = (p: Profile) => write('metropoly:profile', JSON.stringify(p));

export const loadPref = (k: string, def: string) => read(`metropoly:${k}`) ?? def;
export const savePref = (k: string, v: string) => write(`metropoly:${k}`, v);
