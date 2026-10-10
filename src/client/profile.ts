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

let cachedClientId: string | null = null;

/**
 * Stable id of this browser. Kept in memory too: when storage is blocked (private mode,
 * in-app browsers) every read would otherwise create a new id and the player would stop
 * being recognised, e.g. as the host of their own room.
 */
export function getClientId(): string {
  if (cachedClientId) return cachedClientId;
  let id = read('metropoly:clientId');
  if (!id) {
    try {
      id = sessionStorage.getItem('metropoly:clientId');
    } catch {
      /* blocked too */
    }
  }
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    write('metropoly:clientId', id);
    try {
      sessionStorage.setItem('metropoly:clientId', id);
    } catch {
      /* blocked too */
    }
  }
  cachedClientId = id;
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
