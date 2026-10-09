import type { Lang } from '../shared/i18n';
import { EDITABLE_SPACES, sanitizeTheme, spaceOf, type BoardTheme } from '../shared/theme';
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

/** New board pre-filled with the default texts (in the given language), ready to edit. */
export function newBoard(title = 'Il mio tabellone', lang: Lang = 'it'): BoardTheme {
  const spaces: BoardTheme['spaces'] = {};
  for (const i of EDITABLE_SPACES) {
    const sp = spaceOf(null, i, lang);
    spaces[i] = { name: sp.name, short: sp.short, icon: sp.icon, city: sp.city };
  }
  return { id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title, spaces, groups: {} };
}

export interface BoardTemplate {
  title: [string, string];
  description: [string, string];
  build: (lang: Lang) => BoardTheme;
}

type Item = [icon: string, it: string, en: string];

const fill = (title: string, lang: Lang, groups: BoardTheme['groups'], items: Record<number, Item>): BoardTheme => {
  const b = newBoard(title, lang);
  b.groups = groups;
  for (const [i, [icon, it, en]] of Object.entries(items)) {
    const name = lang === 'en' ? en : it;
    b.spaces[+i] = { icon, name, short: name.length > 12 ? undefined : name };
  }
  return b;
};

const pick = (lang: Lang, it: string, en: string) => (lang === 'en' ? en : it);

export const TEMPLATES: BoardTemplate[] = [
  {
    title: ['Classico Metropoly', 'Classic Metropoly'],
    description: ['Le attività del tabellone standard, da modificare come vuoi.', 'The standard board businesses, ready for you to change.'],
    build: (lang) => newBoard(pick(lang, 'Il mio tabellone', 'My board'), lang),
  },
  {
    title: ['Ufficio / Team building', 'Office / Team building'],
    description: ['Reparti e luoghi di un’azienda: perfetto per eventi aziendali.', 'Departments and places of a company: perfect for work events.'],
    build: (lang) =>
      fill(
        pick(lang, 'Tabellone aziendale', 'Office board'),
        lang,
        lang === 'en'
          ? { brown: 'Entrance', lightblue: 'Break', pink: 'Meetings', orange: 'Marketing', red: 'Sales', yellow: 'Product', green: 'Tech', darkblue: 'Management', airport: 'Offices', utility: 'Facilities' }
          : { brown: 'Ingresso', lightblue: 'Pausa', pink: 'Riunioni', orange: 'Marketing', red: 'Vendite', yellow: 'Prodotto', green: 'Tecnologia', darkblue: 'Direzione', airport: 'Sedi', utility: 'Servizi' },
        {
          1: ['🚪', 'Reception', 'Reception'], 3: ['📬', 'Ufficio Posta', 'Mail Room'], 6: ['☕', 'Macchinetta Caffè', 'Coffee Machine'],
          8: ['🥪', 'Mensa', 'Canteen'], 9: ['🛋️', 'Area Relax', 'Lounge'], 11: ['📋', 'Sala Riunioni A', 'Meeting Room A'],
          13: ['📊', 'Sala Riunioni B', 'Meeting Room B'], 14: ['🎤', 'Auditorium', 'Auditorium'], 16: ['📣', 'Social Media', 'Social Media'],
          18: ['🎨', 'Grafica', 'Design'], 19: ['📰', 'Ufficio Stampa', 'Press Office'], 21: ['📞', 'Call Center', 'Call Center'],
          23: ['🤝', 'Commerciale', 'Sales Team'], 24: ['💼', 'Grandi Clienti', 'Key Accounts'], 26: ['🧪', 'Laboratorio', 'Lab'],
          27: ['📦', 'Magazzino', 'Warehouse'], 29: ['🏭', 'Produzione', 'Production'], 31: ['🖥️', 'IT Support', 'IT Support'],
          32: ['☁️', 'Server Room', 'Server Room'], 34: ['🤖', 'Team AI', 'AI Team'], 37: ['📈', 'Ufficio CFO', 'CFO Office'],
          39: ['👑', 'Ufficio CEO', 'CEO Office'], 5: ['🏢', 'Sede Sud', 'South Office'], 15: ['🏢', 'Sede Ovest', 'West Office'],
          25: ['🏢', 'Sede Nord', 'North Office'], 35: ['🏢', 'Sede Est', 'East Office'], 12: ['🔌', 'Rete Elettrica', 'Power Grid'],
          28: ['🚰', 'Impianto Idrico', 'Water System'],
        },
      ),
  },
  {
    title: ['La mia città', 'My town'],
    description: ['Vie, piazze e locali: sostituiscili con quelli della tua città.', 'Streets, squares and venues: replace them with your town’s.'],
    build: (lang) =>
      fill(
        pick(lang, 'La mia città', 'My town'),
        lang,
        lang === 'en'
          ? { brown: 'Outskirts', lightblue: 'Neighbourhood', pink: 'Downtown', orange: 'Seafront', red: 'Squares', yellow: 'Shopping', green: 'Hills', darkblue: 'VIP', airport: 'Stations', utility: 'Utilities' }
          : { brown: 'Periferia', lightblue: 'Quartiere', pink: 'Centro', orange: 'Lungomare', red: 'Piazze', yellow: 'Shopping', green: 'Collina', darkblue: 'Vip', airport: 'Stazioni', utility: 'Servizi' },
        {
          1: ['🏚️', 'Vicolo Stretto', 'Narrow Alley'], 3: ['🛣️', 'Viale Industria', 'Factory Road'], 6: ['🏫', 'Via della Scuola', 'School Street'],
          8: ['⛪', 'Piazza Chiesa', 'Church Square'], 9: ['🌳', 'Parco Giochi', 'Playground'], 11: ['🏛️', 'Municipio', 'Town Hall'],
          13: ['📚', 'Biblioteca', 'Library'], 14: ['🎭', 'Teatro', 'Theatre'], 16: ['🏖️', 'Spiaggia', 'Beach'], 18: ['⛵', 'Porto', 'Harbour'],
          19: ['🎡', 'Luna Park', 'Funfair'], 21: ['⛲', 'Piazza Fontana', 'Fountain Square'], 23: ['🕰️', 'Piazza Orologio', 'Clock Square'],
          24: ['🏰', 'Castello', 'Castle'], 26: ['🛍️', 'Corso Principale', 'High Street'], 27: ['🏬', 'Centro Commerciale', 'Shopping Mall'],
          29: ['💎', 'Via del Lusso', 'Luxury Lane'], 31: ['🍇', 'Vigneti', 'Vineyards'], 32: ['🏡', 'Ville in Collina', 'Hill Villas'],
          34: ['🔭', 'Osservatorio', 'Observatory'], 37: ['🏨', 'Hotel Panorama', 'Panorama Hotel'], 39: ['🏯', 'Torre Panoramica', 'Sky Tower'],
          5: ['🚉', 'Stazione Sud', 'South Station'], 15: ['🚌', 'Autostazione', 'Bus Station'], 25: ['🚉', 'Stazione Nord', 'North Station'],
          35: ['🚇', 'Metro Centrale', 'Central Metro'], 12: ['⚡', 'Centrale Elettrica', 'Power Plant'], 28: ['💧', 'Acquedotto', 'Waterworks'],
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
