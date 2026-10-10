export type Lang = 'it' | 'en';

/**
 * English versions of the fixed Italian messages produced by the engine and the server.
 * Italian is the canonical text; clients translate on display.
 */
const MESSAGES_EN: Record<string, string> = {
  'Non è il tuo turno': 'It’s not your turn',
  'Azione non disponibile ora': 'Action not available right now',
  'Devi prima saldare i tuoi debiti': 'Pay your debts first',
  'Giocatore sconosciuto': 'Unknown player',
  'Sei in bancarotta': 'You are bankrupt',
  'La partita è finita': 'The game is over',
  'Non sei in prigione': 'You are not in jail',
  'Contanti insufficienti': 'Not enough cash',
  'Non hai carte': 'You have no cards',
  'Nessuna asta in corso': 'No auction in progress',
  'Offerta troppo bassa': 'Bid too low',
  'Non hai debiti': 'You have no debts',
  'Hai già troppe proposte in sospeso': 'You already have too many pending offers',
  'Proposta non trovata': 'Offer not found',
  'Questa proposta non è per te': 'This offer is not for you',
  'Non è una tua proposta': 'This is not your offer',
  'Azione sconosciuta': 'Unknown action',
  'Non edificabile': 'You can’t build here',
  'Non è tua': 'You don’t own it',
  'Ti serve tutto il gruppo': 'You need the whole set',
  'Una proprietà del gruppo è ipotecata': 'A property in the set is mortgaged',
  'Hai già un albergo': 'It already has a hotel',
  'Costruisci in modo uniforme': 'Build evenly across the set',
  'Nessun edificio': 'No buildings',
  'Vendi in modo uniforme': 'Sell evenly across the set',
  'Già ipotecata': 'Already mortgaged',
  'Vendi prima gli edifici del gruppo': 'Sell the buildings in the set first',
  'Non è ipotecata': 'Not mortgaged',
  'Giocatore non valido': 'Invalid player',
  'Non puoi scambiare con te stesso': 'You can’t trade with yourself',
  'Valori non validi': 'Invalid values',
  'Carte non disponibili': 'Cards not available',
  'Proprietà duplicate': 'Duplicate properties',
  'Proprietà non valide (o con edifici nel gruppo)': 'Invalid properties (or buildings in the set)',
  'Lo scambio è vuoto': 'The trade is empty',
  'Non connesso': 'Not connected',
  'Stanza non trovata': 'Room not found',
  'La stanza è piena': 'The room is full',
  'Solo l’host può modificare': 'Only the host can change this',
  'Solo l’host può aggiungere bot': 'Only the host can add bots',
  'Solo l’host può iniziare': 'Only the host can start',
  'Solo l’host può cambiare il tabellone': 'Only the host can change the board',
  'Servono almeno 2 giocatori': 'At least 2 players are needed',
  'Nessuna partita in corso': 'No game in progress',
  'Sei uno spettatore': 'You are a spectator',
  'Azione non valida': 'Invalid action',
  'Server non raggiungibile': 'Server unreachable',
  'Impossibile entrare': 'Unable to join',
  'Questa squadra è al completo': 'This team is full',
};

const PATTERNS_EN: [RegExp, (...m: string[]) => string][] = [
  [/^(.+) non ha abbastanza contanti$/, (_, n) => `${n} doesn’t have enough cash`],
  [/^Servono (\d+) giocatori per squadra$/, (_, n) => `${n} players per team are needed`],
  [/^Scambio non più valido: (.+)$/, (_, r) => `Trade no longer valid: ${translateMessage('en', r)}`],
];

export function translateMessage(lang: Lang, msg: string | undefined): string {
  if (!msg || lang === 'it') return msg ?? '';
  if (MESSAGES_EN[msg]) return MESSAGES_EN[msg];
  for (const [re, fn] of PATTERNS_EN) {
    const m = msg.match(re);
    if (m) return fn(...m);
  }
  return msg;
}
