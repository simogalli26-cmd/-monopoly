import { BOARD } from '../shared/board';
import { EDITABLE_SPACES, sanitizeTheme, type BoardTheme } from '../shared/theme';
import { loadPref, savePref } from './profile';

/** Custom boards are kept in this browser; sharing happens through links. */
export function listBoards(): BoardTheme[] {
  try {
    const raw = JSON.parse(loadPref('boards', '[]'));
    return Array.isArray(raw) ? raw.map(sanitizeTheme).filter((b): b is BoardTheme => !!b) : [];
  } catch {
    return [];
  }
}

export function saveBoard(b: BoardTheme) {
  const all = listBoards().filter((x) => x.id !== b.id);
  savePref('boards', JSON.stringify([b, ...all]));
}

export function deleteBoard(id: string) {
  savePref('boards', JSON.stringify(listBoards().filter((x) => x.id !== id)));
}

export const getBoard = (id: string | null | undefined) => (id ? listBoards().find((b) => b.id === id) ?? null : null);

/** New board pre-filled with the default texts, ready to edit. */
export function newBoard(title = 'Il mio tabellone'): BoardTheme {
  const spaces: BoardTheme['spaces'] = {};
  for (const i of EDITABLE_SPACES) {
    const sp = BOARD[i];
    spaces[i] = { name: sp.name, short: sp.short, icon: sp.icon, city: sp.city };
  }
  return { id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title, spaces, groups: {} };
}

export interface BoardTemplate {
  title: string;
  description: string;
  build: () => BoardTheme;
}

const fill = (title: string, groups: BoardTheme['groups'], items: Record<number, [string, string, string?]>): BoardTheme => {
  const b = newBoard(title);
  b.groups = groups;
  for (const [i, [icon, name, city]] of Object.entries(items)) b.spaces[+i] = { icon, name, short: name.length > 12 ? undefined : name, city };
  return b;
};

export const TEMPLATES: BoardTemplate[] = [
  {
    title: 'Classico Metropoly',
    description: 'Le attività del tabellone standard, da modificare come vuoi.',
    build: () => newBoard('Il mio tabellone'),
  },
  {
    title: 'Ufficio / Team building',
    description: 'Reparti e luoghi di un’azienda: perfetto per eventi aziendali.',
    build: () =>
      fill(
        'Tabellone aziendale',
        { brown: 'Ingresso', lightblue: 'Pausa', pink: 'Riunioni', orange: 'Marketing', red: 'Vendite', yellow: 'Prodotto', green: 'Tecnologia', darkblue: 'Direzione', airport: 'Sedi', utility: 'Servizi' },
        {
          1: ['🚪', 'Reception'], 3: ['📬', 'Ufficio Posta'], 6: ['☕', 'Macchinetta Caffè'], 8: ['🥪', 'Mensa'], 9: ['🛋️', 'Area Relax'],
          11: ['📋', 'Sala Riunioni A'], 13: ['📊', 'Sala Riunioni B'], 14: ['🎤', 'Auditorium'], 16: ['📣', 'Social Media'], 18: ['🎨', 'Grafica'],
          19: ['📰', 'Ufficio Stampa'], 21: ['📞', 'Call Center'], 23: ['🤝', 'Commerciale'], 24: ['💼', 'Grandi Clienti'], 26: ['🧪', 'Laboratorio'],
          27: ['📦', 'Magazzino'], 29: ['🏭', 'Produzione'], 31: ['🖥️', 'IT Support'], 32: ['☁️', 'Server Room'], 34: ['🤖', 'Team AI'],
          37: ['📈', 'Ufficio CFO'], 39: ['👑', 'Ufficio CEO'], 5: ['🏢', 'Sede Sud'], 15: ['🏢', 'Sede Ovest'], 25: ['🏢', 'Sede Nord'],
          35: ['🏢', 'Sede Est'], 12: ['🔌', 'Rete Elettrica'], 28: ['🚰', 'Impianto Idrico'],
        },
      ),
  },
  {
    title: 'La mia città',
    description: 'Vie, piazze e locali: sostituiscili con quelli della tua città.',
    build: () =>
      fill(
        'La mia città',
        { brown: 'Periferia', lightblue: 'Quartiere', pink: 'Centro', orange: 'Lungomare', red: 'Piazze', yellow: 'Shopping', green: 'Collina', darkblue: 'Vip', airport: 'Stazioni', utility: 'Servizi' },
        {
          1: ['🏚️', 'Vicolo Stretto'], 3: ['🛣️', 'Viale Industria'], 6: ['🏫', 'Via della Scuola'], 8: ['⛪', 'Piazza Chiesa'], 9: ['🌳', 'Parco Giochi'],
          11: ['🏛️', 'Municipio'], 13: ['📚', 'Biblioteca'], 14: ['🎭', 'Teatro'], 16: ['🏖️', 'Spiaggia'], 18: ['⛵', 'Porto'],
          19: ['🎡', 'Luna Park'], 21: ['⛲', 'Piazza Fontana'], 23: ['🕰️', 'Piazza Orologio'], 24: ['🏰', 'Castello'], 26: ['🛍️', 'Corso Principale'],
          27: ['🏬', 'Centro Commerciale'], 29: ['💎', 'Via del Lusso'], 31: ['🍇', 'Vigneti'], 32: ['🏡', 'Ville in Collina'], 34: ['🔭', 'Osservatorio'],
          37: ['🏨', 'Hotel Panorama'], 39: ['🏯', 'Torre Panoramica'], 5: ['🚉', 'Stazione Sud'], 15: ['🚌', 'Autostazione'], 25: ['🚉', 'Stazione Nord'],
          35: ['🚇', 'Metro Centrale'], 12: ['⚡', 'Centrale Elettrica'], 28: ['💧', 'Acquedotto'],
        },
      ),
  },
];

export const EMOJI_PALETTE = [
  '🍔', '🍕', '🌭', '🌮', '🍣', '🍦', '☕', '🥐', '🍰', '🍺', '🍷', '🥗',
  '🎬', '🎳', '🕹️', '🎮', '🎤', '🎭', '🎡', '🎢', '🏟️', '⚽', '🏀', '🎾',
  '👟', '👗', '💍', '👜', '💄', '🕶️', '📱', '💻', '🎧', '📷', '🖥️', '⌚',
  '💪', '🧖', '🏥', '💊', '🧘', '🚴', '🤖', '☁️', '🛰️', '🧪', '🔬', '🚀',
  '🏝️', '🏨', '🏰', '🏛️', '🏢', '🏠', '🏫', '⛪', '🌳', '🏖️', '⛵', '✈️',
  '🚉', '🚌', '⚡', '💧', '☀️', '🔌', '📚', '🎨', '🐶', '🐱', '👑', '💎',
];
