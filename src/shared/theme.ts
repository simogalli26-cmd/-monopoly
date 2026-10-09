import { BOARD, GROUP_MEMBERS, GROUP_NAMES, GROUP_NAMES_EN, NAMES_EN } from './board';
import type { Lang } from './i18n';
import type { Deck, Group, Space } from './types';

/** Texts a custom board can change. Prices and rules always stay the same. */
export interface SpaceText {
  name: string;
  short?: string;
  icon?: string;
  city?: string;
}

export interface BoardTheme {
  id: string;
  title: string;
  /** Overrides by board index (ownable spaces only). */
  spaces: Record<number, SpaceText>;
  groups: Partial<Record<Group, string>>;
}

export const DECK_NAMES: Record<Deck, string> = { chance: 'Colpo di Scena', chest: 'Notizie di Mercato' };
export const DECK_NAMES_EN: Record<Deck, string> = { chance: 'Plot Twist', chest: 'Market News' };
export const deckName = (deck: Deck, lang: Lang = 'it') => (lang === 'en' ? DECK_NAMES_EN : DECK_NAMES)[deck];
export const DECK_ICONS: Record<Deck, string> = { chance: '🎭', chest: '📰' };

/** Spaces whose name, icon and city can be customised. */
export const EDITABLE_SPACES = BOARD.filter((s) => s.type === 'property' || s.type === 'airport' || s.type === 'utility').map(
  (s) => s.index,
);
export const EDITABLE_GROUPS = Object.keys(GROUP_MEMBERS) as Group[];

export const MAX_NAME = 28;
export const MAX_SHORT = 14;
export const MAX_TITLE = 40;

/** Board space with the theme's texts applied. */
export function spaceOf(theme: BoardTheme | null | undefined, index: number, lang: Lang = 'it'): Space {
  let base = BOARD[index];
  if (lang === 'en' && NAMES_EN[index]) base = { ...base, name: NAMES_EN[index][0], short: NAMES_EN[index][1] };
  const o = theme?.spaces?.[index];
  if (!o) return base;
  return { ...base, name: o.name || base.name, short: o.short || (o.name ? undefined : base.short), icon: o.icon || base.icon, city: o.city ?? base.city };
}

export const nameOf = (theme: BoardTheme | null | undefined, index: number, lang: Lang = 'it') => spaceOf(theme, index, lang).name;

export const shortOf = (theme: BoardTheme | null | undefined, index: number, lang: Lang = 'it') => {
  const sp = spaceOf(theme, index, lang);
  return sp.short ?? sp.name;
};

export const groupLabel = (theme: BoardTheme | null | undefined, g: Group, lang: Lang = 'it') =>
  theme?.groups?.[g] || (lang === 'en' ? GROUP_NAMES_EN : GROUP_NAMES)[g];

/** Card texts may reference spaces as {index}. */
export const cardText = (theme: BoardTheme | null | undefined, text: string, lang: Lang = 'it') =>
  text.replace(/\{(\d+)\}/g, (_, i) => nameOf(theme, Number(i), lang));

const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, max);

/** Keeps only one grapheme-ish emoji/short symbol for icons. */
const cleanIcon = (v: unknown) => Array.from(clean(v, 16)).slice(0, 4).join('');

/** Validates untrusted theme data (from the network or a share link). */
export function sanitizeTheme(raw: unknown): BoardTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<BoardTheme>;
  const spaces: Record<number, SpaceText> = {};
  for (const i of EDITABLE_SPACES) {
    const o = r.spaces?.[i];
    if (!o || typeof o !== 'object') continue;
    const name = clean(o.name, MAX_NAME);
    if (!name) continue;
    spaces[i] = { name, short: clean(o.short, MAX_SHORT) || undefined, icon: cleanIcon(o.icon) || undefined, city: clean(o.city, MAX_SHORT * 2) || undefined };
  }
  const groups: Partial<Record<Group, string>> = {};
  for (const g of EDITABLE_GROUPS) {
    const v = clean(r.groups?.[g], 24);
    if (v) groups[g] = v;
  }
  return {
    id: clean(r.id, 40) || `b${Date.now().toString(36)}`,
    title: clean(r.title, MAX_TITLE) || 'Tabellone personalizzato',
    spaces,
    groups,
  };
}

/** Compact, URL-safe share code for a theme. */
export function encodeTheme(theme: BoardTheme): string {
  const json = JSON.stringify(theme);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeTheme(code: string): BoardTheme | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitizeTheme(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
