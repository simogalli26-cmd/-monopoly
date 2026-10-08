export type ColorGroup =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkblue';

export type Group = ColorGroup | 'airport' | 'utility';

export type SpaceType =
  | 'go'
  | 'property'
  | 'airport'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'parking'
  | 'gotojail';

export interface Space {
  index: number;
  type: SpaceType;
  name: string;
  /** Short label used on small tiles. */
  short?: string;
  group?: Group;
  /** Emoji shown on the tile (the business for properties). */
  icon?: string;
  /** City where the business is located. */
  city?: string;
  price?: number;
  /** For properties: [base, 1 house, 2, 3, 4, hotel]. */
  rent?: number[];
  houseCost?: number;
  tax?: number;
}

export type BotLevel = 'easy' | 'normal' | 'hard';

export interface Settings {
  startingCash: number;
  /** Rent doubles on unimproved properties of a complete color set. */
  doubleRentOnSet: boolean;
  /** Declined properties go to an auction. */
  auctions: boolean;
  /** Taxes and fines go into a pot collected on Free Parking. */
  freeParkingPot: boolean;
  /** Owners in jail don't collect rent. */
  noRentInJail: boolean;
  /** Houses must be built/sold evenly across a set. */
  evenBuild: boolean;
  /** Landing exactly on GO pays double salary. */
  doubleGoOnLanding: boolean;
  /** Shuffle the player order at start. */
  randomOrder: boolean;
  /** Seconds per decision, 0 = unlimited. */
  turnTime: number;
  maxPlayers: number;
  /** Seconds an auction lasts without new bids. */
  auctionTime: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  token: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  /** Decks the held "get out of jail free" cards came from. */
  jailCards: Deck[];
  bankrupt: boolean;
  /** Order of elimination (1 = first out). */
  bankruptOrder?: number;
  isBot: boolean;
  botLevel?: BotLevel;
  doubles: number;
}

export interface Ownership {
  owner: string | null;
  /** 0-4 houses, 5 = hotel. */
  houses: number;
  mortgaged: boolean;
}

export interface Debt {
  from: string;
  /** null = bank (or pot). */
  to: string | null;
  amount: number;
  reason: string;
  toPot: boolean;
  createdAt: number;
}

export interface Auction {
  space: number;
  highBid: number;
  highBidder: string | null;
  endsAt: number;
}

export interface TradeOffer {
  id: string;
  from: string;
  to: string;
  giveProps: number[];
  getProps: number[];
  giveCash: number;
  getCash: number;
  giveCards: number;
  getCards: number;
  createdAt: number;
}

export type TradeDraft = Omit<TradeOffer, 'id' | 'from' | 'createdAt'>;

export type Phase = 'roll' | 'buy' | 'auction' | 'end' | 'over';

export type Deck = 'chance' | 'chest';

export type LogKind = 'info' | 'money' | 'card' | 'jail' | 'trade' | 'buy' | 'build' | 'danger' | 'turn';

export interface LogEntry {
  id: number;
  text: string;
  kind: LogKind;
}

export interface DrawnCard {
  seq: number;
  deck: Deck;
  card: number;
  playerId: string;
}

export interface GameState {
  id: string;
  /** Custom board texts (null = default board). */
  theme?: import('./theme').BoardTheme | null;
  settings: Settings;
  players: Player[];
  /** Indexed by board space; non-ownable spaces always have owner null. */
  ownership: Ownership[];
  turn: number;
  round: number;
  phase: Phase;
  dice: [number, number];
  rollSeq: number;
  rolledDoubles: boolean;
  pot: number;
  decks: Record<Deck, number[]>;
  auction: Auction | null;
  trades: TradeOffer[];
  debts: Debt[];
  log: LogEntry[];
  logSeq: number;
  lastCard: DrawnCard | null;
  winner: string | null;
  turnDeadline: number | null;
  seed: number;
  startedAt: number;
  version: number;
}

export type Action =
  | { type: 'roll' }
  | { type: 'payJail' }
  | { type: 'useJailCard' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'bid'; amount: number }
  | { type: 'build'; space: number }
  | { type: 'sell'; space: number }
  | { type: 'mortgage'; space: number }
  | { type: 'unmortgage'; space: number }
  | { type: 'payDebt' }
  | { type: 'bankrupt' }
  | { type: 'endTurn' }
  | { type: 'proposeTrade'; offer: TradeDraft }
  | { type: 'acceptTrade'; id: string }
  | { type: 'rejectTrade'; id: string }
  | { type: 'cancelTrade'; id: string };

export interface PlayerSeat {
  id: string;
  name: string;
  color: string;
  token: string;
  isBot: boolean;
  botLevel?: BotLevel;
}
