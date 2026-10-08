import type { ColorGroup, Group, Settings, Space } from './types';

export const GO_SALARY = 200;
export const JAIL_INDEX = 10;
export const JAIL_FINE = 50;
export const BOARD_SIZE = 40;

export const GROUP_COLORS: Record<Group, string> = {
  brown: '#9b5b3a',
  lightblue: '#7cc8f0',
  pink: '#e05aa8',
  orange: '#f39a33',
  red: '#e8434b',
  yellow: '#f5d33b',
  green: '#2fb36b',
  darkblue: '#3a5bd9',
  airport: '#5b6478',
  utility: '#8a94a8',
};

export const GROUP_NAMES: Record<Group, string> = {
  brown: 'Grecia',
  lightblue: 'Portogallo',
  pink: 'Spagna',
  orange: 'Germania',
  red: 'Italia',
  yellow: 'Francia',
  green: 'Regno Unito',
  darkblue: 'Stati Uniti',
  airport: 'Aeroporti',
  utility: 'Servizi',
};

const p = (
  index: number,
  name: string,
  group: ColorGroup,
  icon: string,
  price: number,
  rent: number[],
  houseCost: number,
): Space => ({ index, type: 'property', name, group, icon, price, rent, houseCost });

const air = (index: number, name: string, short: string): Space => ({
  index,
  type: 'airport',
  name,
  short,
  group: 'airport',
  icon: '✈️',
  price: 200,
});

export const BOARD: Space[] = [
  { index: 0, type: 'go', name: 'VIA', icon: '➜' },
  p(1, 'Salonicco', 'brown', '🇬🇷', 60, [2, 10, 30, 90, 160, 250], 50),
  { index: 2, type: 'chest', name: 'Probabilità', icon: '🎁' },
  p(3, 'Atene', 'brown', '🇬🇷', 60, [4, 20, 60, 180, 320, 450], 50),
  { index: 4, type: 'tax', name: 'Tassa sul reddito', short: 'Tassa', icon: '💸', tax: 200 },
  air(5, 'Aeroporto di Fiumicino', 'Fiumicino'),
  p(6, 'Coimbra', 'lightblue', '🇵🇹', 100, [6, 30, 90, 270, 400, 550], 50),
  { index: 7, type: 'chance', name: 'Imprevisti', icon: '❓' },
  p(8, 'Porto', 'lightblue', '🇵🇹', 100, [6, 30, 90, 270, 400, 550], 50),
  p(9, 'Lisbona', 'lightblue', '🇵🇹', 120, [8, 40, 100, 300, 450, 600], 50),
  { index: 10, type: 'jail', name: 'Prigione', icon: '🔒' },
  p(11, 'Siviglia', 'pink', '🇪🇸', 140, [10, 50, 150, 450, 625, 750], 100),
  { index: 12, type: 'utility', name: 'Società Elettrica', short: 'Elettrica', group: 'utility', icon: '⚡', price: 150 },
  p(13, 'Valencia', 'pink', '🇪🇸', 140, [10, 50, 150, 450, 625, 750], 100),
  p(14, 'Barcellona', 'pink', '🇪🇸', 160, [12, 60, 180, 500, 700, 900], 100),
  air(15, 'Aeroporto di Heathrow', 'Heathrow'),
  p(16, 'Amburgo', 'orange', '🇩🇪', 180, [14, 70, 200, 550, 750, 950], 100),
  { index: 17, type: 'chest', name: 'Probabilità', icon: '🎁' },
  p(18, 'Monaco di Baviera', 'orange', '🇩🇪', 180, [14, 70, 200, 550, 750, 950], 100),
  p(19, 'Berlino', 'orange', '🇩🇪', 200, [16, 80, 220, 600, 800, 1000], 100),
  { index: 20, type: 'parking', name: 'Parcheggio gratuito', short: 'Parcheggio', icon: '🅿️' },
  p(21, 'Napoli', 'red', '🇮🇹', 220, [18, 90, 250, 700, 875, 1050], 150),
  { index: 22, type: 'chance', name: 'Imprevisti', icon: '❓' },
  p(23, 'Milano', 'red', '🇮🇹', 220, [18, 90, 250, 700, 875, 1050], 150),
  p(24, 'Roma', 'red', '🇮🇹', 240, [20, 100, 300, 750, 925, 1100], 150),
  air(25, 'Aeroporto Charles de Gaulle', 'Charles de Gaulle'),
  p(26, 'Lione', 'yellow', '🇫🇷', 260, [22, 110, 330, 800, 975, 1150], 150),
  p(27, 'Nizza', 'yellow', '🇫🇷', 260, [22, 110, 330, 800, 975, 1150], 150),
  { index: 28, type: 'utility', name: 'Acquedotto', short: 'Acquedotto', group: 'utility', icon: '💧', price: 150 },
  p(29, 'Parigi', 'yellow', '🇫🇷', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { index: 30, type: 'gotojail', name: 'In prigione!', short: 'Prigione!', icon: '👮' },
  p(31, 'Manchester', 'green', '🇬🇧', 300, [26, 130, 390, 900, 1100, 1275], 200),
  p(32, 'Edimburgo', 'green', '🇬🇧', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { index: 33, type: 'chest', name: 'Probabilità', icon: '🎁' },
  p(34, 'Londra', 'green', '🇬🇧', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  air(35, 'Aeroporto JFK', 'JFK'),
  { index: 36, type: 'chance', name: 'Imprevisti', icon: '❓' },
  p(37, 'San Francisco', 'darkblue', '🇺🇸', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { index: 38, type: 'tax', name: 'Tassa di lusso', short: 'Lusso', icon: '💎', tax: 100 },
  p(39, 'New York', 'darkblue', '🇺🇸', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const GROUP_MEMBERS: Record<Group, number[]> = BOARD.reduce(
  (acc, s) => {
    if (s.group) (acc[s.group] ||= []).push(s.index);
    return acc;
  },
  {} as Record<Group, number[]>,
);

export const isOwnable = (index: number): boolean => {
  const t = BOARD[index]?.type;
  return t === 'property' || t === 'airport' || t === 'utility';
};

export const mortgageValue = (index: number): number => Math.floor((BOARD[index].price ?? 0) / 2);
export const unmortgageCost = (index: number): number => Math.ceil(mortgageValue(index) * 1.1);

export const DEFAULT_SETTINGS: Settings = {
  startingCash: 1500,
  doubleRentOnSet: true,
  auctions: true,
  freeParkingPot: false,
  noRentInJail: false,
  evenBuild: true,
  doubleGoOnLanding: false,
  randomOrder: true,
  turnTime: 0,
  maxPlayers: 6,
  auctionTime: 8,
};

export const PLAYER_COLORS = ['#ff5d73', '#3fb6ff', '#ffd23f', '#3ee08f', '#b07cff', '#ff9a3c', '#2ee6d6', '#ff7ad9'];
export const PLAYER_TOKENS = ['🚗', '🎩', '🐶', '🚀', '⚓', '🦖', '👑', '🎸', '🐱', '🛸', '🦄', '🍕'];

export type CardEffect =
  | { kind: 'advance'; to: number }
  | { kind: 'nearest'; group: 'airport' | 'utility' }
  | { kind: 'back'; steps: number }
  | { kind: 'cash'; amount: number }
  | { kind: 'eachPlayer'; amount: number }
  | { kind: 'repairs'; house: number; hotel: number }
  | { kind: 'jail' }
  | { kind: 'jailFree' };

export interface Card {
  text: string;
  effect: CardEffect;
}

export const CHANCE_CARDS: Card[] = [
  { text: 'Vai avanti fino al VIA e ritira 200.', effect: { kind: 'advance', to: 0 } },
  { text: 'Vola a Roma. Se passi dal VIA ritira 200.', effect: { kind: 'advance', to: 24 } },
  { text: 'Fai tappa a Siviglia. Se passi dal VIA ritira 200.', effect: { kind: 'advance', to: 11 } },
  { text: 'Vai al servizio più vicino. Se è di un altro giocatore paghi 10 volte il lancio dei dadi.', effect: { kind: 'nearest', group: 'utility' } },
  { text: "Vai all'aeroporto più vicino. Se è di un altro giocatore paghi il doppio.", effect: { kind: 'nearest', group: 'airport' } },
  { text: "Vai all'aeroporto più vicino. Se è di un altro giocatore paghi il doppio.", effect: { kind: 'nearest', group: 'airport' } },
  { text: 'La banca ti paga un dividendo di 50.', effect: { kind: 'cash', amount: 50 } },
  { text: 'Esci gratis di prigione. Conserva questa carta.', effect: { kind: 'jailFree' } },
  { text: 'Torna indietro di 3 caselle.', effect: { kind: 'back', steps: 3 } },
  { text: 'Vai direttamente in prigione senza passare dal VIA.', effect: { kind: 'jail' } },
  { text: 'Manutenzione generale: paga 25 per casa e 100 per albergo.', effect: { kind: 'repairs', house: 25, hotel: 100 } },
  { text: 'Multa per eccesso di velocità: paga 15.', effect: { kind: 'cash', amount: -15 } },
  { text: "Prendi un volo da Fiumicino. Se passi dal VIA ritira 200.", effect: { kind: 'advance', to: 5 } },
  { text: 'Fai un giro a New York.', effect: { kind: 'advance', to: 39 } },
  { text: 'Sei eletto presidente del consiglio: paga 50 a ogni giocatore.', effect: { kind: 'eachPlayer', amount: -50 } },
  { text: 'Il tuo investimento rende: ritira 150.', effect: { kind: 'cash', amount: 150 } },
];

export const CHEST_CARDS: Card[] = [
  { text: 'Vai avanti fino al VIA e ritira 200.', effect: { kind: 'advance', to: 0 } },
  { text: 'Errore della banca a tuo favore: ritira 200.', effect: { kind: 'cash', amount: 200 } },
  { text: 'Visita medica: paga 50.', effect: { kind: 'cash', amount: -50 } },
  { text: 'Vendi le tue azioni: ritira 50.', effect: { kind: 'cash', amount: 50 } },
  { text: 'Esci gratis di prigione. Conserva questa carta.', effect: { kind: 'jailFree' } },
  { text: 'Vai direttamente in prigione senza passare dal VIA.', effect: { kind: 'jail' } },
  { text: 'Matura il fondo vacanze: ritira 100.', effect: { kind: 'cash', amount: 100 } },
  { text: 'Rimborso delle tasse: ritira 20.', effect: { kind: 'cash', amount: 20 } },
  { text: 'È il tuo compleanno: ogni giocatore ti regala 10.', effect: { kind: 'eachPlayer', amount: 10 } },
  { text: "L'assicurazione sulla vita matura: ritira 100.", effect: { kind: 'cash', amount: 100 } },
  { text: 'Spese ospedaliere: paga 100.', effect: { kind: 'cash', amount: -100 } },
  { text: 'Retta scolastica: paga 50.', effect: { kind: 'cash', amount: -50 } },
  { text: 'Compenso per consulenza: ritira 25.', effect: { kind: 'cash', amount: 25 } },
  { text: 'Lavori stradali: paga 40 per casa e 115 per albergo.', effect: { kind: 'repairs', house: 40, hotel: 115 } },
  { text: 'Secondo premio in un concorso di bellezza: ritira 10.', effect: { kind: 'cash', amount: 10 } },
  { text: 'Erediti 100.', effect: { kind: 'cash', amount: 100 } },
];
