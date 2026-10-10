/** Basic profanity filter for chat and names (Italian + English). Matches are replaced with asterisks. */
const WORDS = [
  // English
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'wanker', 'twat',
  // Italian
  'cazzo', 'cazzi', 'cazzone', 'vaffanculo', 'fanculo', 'stronzo', 'stronza', 'stronzi', 'puttana', 'puttane', 'troia', 'troie', 'merda',
  'coglione', 'coglioni', 'minchia', 'figa', 'fica', 'frocio', 'froci', 'ricchione', 'bastardo', 'bastarda', 'porco dio', 'porcodio',
  'dio cane', 'diocane', 'mignotta', 'zoccola', 'negro', 'handicappato',
];

// Letters may be repeated or separated by symbols to dodge the filter ("f.u.c.k", "cazzzo").
const fuzzy = (w: string) =>
  [...w].map((c, i) => (c === ' ' ? '[\\W_]*' : `${c}+${i < w.length - 1 && w[i + 1] !== ' ' ? '[\\W_]*' : ''}`)).join('');
const PATTERN = new RegExp(`(?<![a-zà-ù])(${WORDS.map(fuzzy).join('|')})(?![a-zà-ù])`, 'gi');

export function filterText(text: string): string {
  return text.replace(PATTERN, (m) => m[0] + '*'.repeat(Math.max(2, m.trim().length - 1)));
}
