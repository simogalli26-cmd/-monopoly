import express from 'express';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { DEFAULT_SETTINGS, PLAYER_COLORS, PLAYER_TOKENS } from '../shared/board';
import { TEAM_SIZE, createGame } from '../shared/engine';
import type { Ack, ChatMessage, CreateRoomPayload, Profile, RoomSeat, RoomSummary, RoomView } from '../shared/protocol';
import { GameRunner } from '../shared/runner';
import { sanitizeTheme, type BoardTheme } from '../shared/theme';
import { filterText } from './chatFilter';
import type { Action, BotLevel, Settings } from '../shared/types';

const PORT = Number(process.env.PORT ?? 3001);
const AUTOPILOT_AFTER_MS = 20_000;
const EMPTY_ROOM_TTL_MS = 5 * 60_000;
const BOT_NAMES = ['Ada', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gaia', 'Ivo', 'Luna', 'Marco', 'Nina', 'Otto'];
const BOT_LEVEL_LABEL: Record<BotLevel, string> = { easy: 'facile', normal: 'medio', hard: 'difficile' };

interface Room {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  settings: Settings;
  theme: BoardTheme | null;
  seats: RoomSeat[];
  status: RoomView['status'];
  runner: GameRunner | null;
  chat: ChatMessage[];
  chatSeq: number;
  emptySince: number | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const rooms = new Map<string, Room>();
const stats = { gamesStarted: 0, gamesFinished: 0, peakOnline: 0, since: new Date().toISOString() };
const siteConfig = {
  supportUrl: process.env.SUPPORT_URL || '',
  contactEmail: process.env.CONTACT_EMAIL || '',
  issuesUrl: process.env.ISSUES_URL || 'https://github.com/simogalli26-cmd/-monopoly/issues',
  owner: process.env.OWNER_NAME || '',
};
const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });

// ---------------------------------------------------------------- utils

const clean = (s: unknown, max: number) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, max);

const newId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function sanitizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  const clamp = (n: unknown, lo: number, hi: number, def: number) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
  };
  return {
    startingCash: clamp(s.startingCash, 500, 5000, 1500),
    doubleRentOnSet: !!s.doubleRentOnSet,
    auctions: !!s.auctions,
    freeParkingPot: !!s.freeParkingPot,
    noRentInJail: !!s.noRentInJail,
    evenBuild: !!s.evenBuild,
    doubleGoOnLanding: !!s.doubleGoOnLanding,
    randomOrder: !!s.randomOrder,
    turnTime: clamp(s.turnTime, 0, 300, 0),
    teamMode: (['none', '2v2', '3v3'] as const).includes(s.teamMode) ? s.teamMode : 'none',
    maxPlayers: s.teamMode === '2v2' ? 4 : s.teamMode === '3v3' ? 6 : clamp(s.maxPlayers, 2, 8, 6),
    auctionTime: clamp(s.auctionTime, 4, 20, 8),
  };
}

function sanitizeProfile(raw: Partial<Profile> | undefined, room?: Room, selfId?: string): Profile {
  const others = room?.seats.filter((x) => x.id !== selfId) ?? [];
  let color = PLAYER_COLORS.includes(String(raw?.color)) ? String(raw!.color) : PLAYER_COLORS[0];
  if (others.some((o) => o.color === color)) color = PLAYER_COLORS.find((c) => !others.some((o) => o.color === c)) ?? color;
  let token = PLAYER_TOKENS.includes(String(raw?.token)) ? String(raw!.token) : PLAYER_TOKENS[0];
  if (others.some((o) => o.token === token)) token = PLAYER_TOKENS.find((t) => !others.some((o) => o.token === t)) ?? token;
  return { name: filterText(clean(raw?.name, 18)) || 'Giocatore', color, token };
}

/** Puts every seat in a team (filling the smaller one) or clears teams in free-for-all. */
function balanceTeams(r: Room) {
  if (r.settings.teamMode === 'none') {
    for (const seat of r.seats) delete seat.team;
    return;
  }
  const size = TEAM_SIZE[r.settings.teamMode];
  const count = (t: number) => r.seats.filter((x) => x.team === t).length;
  for (const seat of r.seats) {
    if (seat.team === 0 || seat.team === 1) {
      if (count(seat.team) <= size) continue;
    }
    delete seat.team;
    seat.team = count(0) <= count(1) ? 0 : 1;
  }
}

const view = (r: Room): RoomView => ({
  id: r.id,
  name: r.name,
  hostId: r.hostId,
  isPrivate: r.isPrivate,
  settings: r.settings,
  seats: r.seats,
  status: r.status,
  theme: r.theme,
});

const summary = (r: Room): RoomSummary => ({
  id: r.id,
  name: r.name,
  host: r.seats.find((s) => s.id === r.hostId)?.name ?? '?',
  players: r.seats.length,
  maxPlayers: r.settings.maxPlayers,
  status: r.status,
  startingCash: r.settings.startingCash,
  tokens: r.seats.map((s) => s.token),
  teamMode: r.settings.teamMode,
});

function broadcastLobby() {
  const list = [...rooms.values()].filter((r) => !r.isPrivate && r.status !== 'finished').map(summary);
  io.to('lobby').emit('lobby:rooms', list);
}

function broadcastRoom(r: Room) {
  io.to(`room:${r.id}`).emit('room:update', view(r));
  broadcastLobby();
}

function systemChat(r: Room, text: string, en?: string) {
  const msg: ChatMessage = { id: ++r.chatSeq, from: 'system', name: '', color: '', text, en, at: Date.now(), system: true };
  r.chat.push(msg);
  if (r.chat.length > 100) r.chat.shift();
  io.to(`room:${r.id}`).emit('chat:msg', msg);
}

function deleteRoom(r: Room) {
  r.runner?.stop();
  rooms.delete(r.id);
  broadcastLobby();
}

// Periodic cleanup of abandoned rooms.
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    const humansOnline = r.seats.some((s) => !s.isBot && s.connected);
    if (humansOnline) r.emptySince = null;
    else if (!r.emptySince) r.emptySince = now;
    else if (now - r.emptySince > EMPTY_ROOM_TTL_MS) deleteRoom(r);
  }
}, 30_000);

// ---------------------------------------------------------------- sockets

const broadcastOnline = () => {
  const online = io.engine.clientsCount;
  stats.peakOnline = Math.max(stats.peakOnline, online);
  io.emit('lobby:online', online);
};

io.on('connection', (socket: Socket) => {
  broadcastOnline();
  socket.on('disconnect', broadcastOnline);
  let clientId = '';
  let roomId: string | null = null;

  const room = () => (roomId ? rooms.get(roomId) : undefined);
  const reply = (ack: unknown, res: Ack) => typeof ack === 'function' && (ack as (r: Ack) => void)(res);
  const isHost = (r: Room) => r.hostId === clientId;

  socket.on('hello', (payload: { clientId?: string }, ack) => {
    clientId = clean(payload?.clientId, 64) || `anon-${socket.id}`;
    socket.data.clientId = clientId;
    socket.join('lobby');
    reply(ack, { ok: true });
    broadcastLobby();
  });

  socket.on('lobby:list', (ack) =>
    reply(ack, { ok: true, data: [...rooms.values()].filter((r) => !r.isPrivate && r.status !== 'finished').map(summary) }),
  );

  function enterRoom(r: Room) {
    if (roomId && roomId !== r.id) leaveRoom(false);
    roomId = r.id;
    socket.leave('lobby');
    socket.join(`room:${r.id}`);
    const seat = r.seats.find((s) => s.id === clientId);
    if (seat) {
      seat.connected = true;
      const t = r.disconnectTimers.get(clientId);
      if (t) clearTimeout(t);
      r.disconnectTimers.delete(clientId);
      if (r.runner?.autopilot.delete(clientId)) systemChat(r, `${seat.name} è tornato in partita.`, `${seat.name} is back in the game.`);
    }
    socket.emit('room:update', view(r));
    socket.emit('chat:history', r.chat);
    if (r.runner) socket.emit('game:state', r.runner.state);
  }

  function leaveRoom(explicit: boolean) {
    const r = room();
    if (!r) return;
    socket.leave(`room:${r.id}`);
    socket.join('lobby');
    roomId = null;
    const seat = r.seats.find((s) => s.id === clientId);
    if (!seat) return;
    if (r.status === 'waiting') {
      r.seats = r.seats.filter((s) => s.id !== clientId);
      systemChat(r, `${seat.name} ha lasciato la stanza.`, `${seat.name} left the room.`);
      if (!r.seats.some((s) => !s.isBot)) return deleteRoom(r);
      if (r.hostId === clientId) r.hostId = (r.seats.find((s) => !s.isBot && s.connected) ?? r.seats.find((s) => !s.isBot))!.id;
    } else if (explicit && r.runner) {
      const p = r.runner.state.players.find((x) => x.id === clientId);
      if (p && !p.bankrupt && r.runner.state.phase !== 'over') {
        r.runner.dispatch(clientId, { type: 'bankrupt' });
        systemChat(r, `${seat.name} ha abbandonato la partita.`, `${seat.name} quit the game.`);
      }
      seat.connected = false;
    } else {
      markDisconnected(r, seat);
    }
    broadcastRoom(r);
  }

  function markDisconnected(r: Room, seat: RoomSeat) {
    seat.connected = false;
    if (!r.runner || r.status !== 'playing') return;
    const id = seat.id;
    r.disconnectTimers.set(
      id,
      setTimeout(() => {
        if (seat.connected || !r.runner) return;
        r.runner.autopilot.add(id);
        systemChat(r, `${seat.name} è disconnesso: il computer gioca al suo posto.`, `${seat.name} disconnected: the computer plays for them.`);
      }, AUTOPILOT_AFTER_MS),
    );
  }

  socket.on('room:create', (payload: CreateRoomPayload, ack) => {
    if (!clientId) return reply(ack, { ok: false, error: 'Non connesso' });
    const id = newId();
    const profile = sanitizeProfile(payload?.profile);
    const r: Room = {
      id,
      name: clean(payload?.name, 32) || `${profile.name}’s room`,
      hostId: clientId,
      isPrivate: !!payload?.isPrivate,
      settings: sanitizeSettings(payload?.settings),
      theme: sanitizeTheme(payload?.theme),
      seats: [{ id: clientId, ...profile, isBot: false, connected: true }],
      status: 'waiting',
      runner: null,
      chat: [],
      chatSeq: 0,
      emptySince: null,
      disconnectTimers: new Map(),
    };
    rooms.set(id, r);
    enterRoom(r);
    systemChat(r, `${profile.name} ha creato la stanza.`, `${profile.name} created the room.`);
    broadcastLobby();
    reply(ack, { ok: true, data: id });
  });

  socket.on('room:join', (payload: { roomId: string; profile: Profile }, ack) => {
    const r = rooms.get(clean(payload?.roomId, 12).toUpperCase());
    if (!r) return reply(ack, { ok: false, error: 'Stanza non trovata' });
    const existing = r.seats.find((s) => s.id === clientId);
    if (!existing) {
      if (r.status !== 'waiting') {
        // Spectator mode.
        enterRoom(r);
        return reply(ack, { ok: true, data: 'spectator' });
      }
      if (r.seats.length >= r.settings.maxPlayers) return reply(ack, { ok: false, error: 'La stanza è piena' });
      const profile = sanitizeProfile(payload?.profile, r, clientId);
      r.seats.push({ id: clientId, ...profile, isBot: false, connected: true });
      balanceTeams(r);
      systemChat(r, `${profile.name} è entrato nella stanza.`, `${profile.name} joined the room.`);
    }
    enterRoom(r);
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:leave', (ack) => {
    leaveRoom(true);
    reply(ack, { ok: true });
  });

  socket.on('room:profile', (profile: Profile, ack) => {
    const r = room();
    const seat = r?.seats.find((s) => s.id === clientId);
    if (!r || !seat || r.status !== 'waiting') return reply(ack, { ok: false });
    Object.assign(seat, sanitizeProfile(profile, r, clientId));
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:settings', (settings: Settings, ack) => {
    const r = room();
    if (!r || !isHost(r) || r.status !== 'waiting') return reply(ack, { ok: false, error: 'Solo l’host può modificare' });
    r.settings = sanitizeSettings(settings);
    while (r.seats.length > r.settings.maxPlayers) {
      const bot = [...r.seats].reverse().find((s) => s.isBot);
      if (!bot) break;
      r.seats = r.seats.filter((s) => s !== bot);
    }
    if (r.settings.teamMode === 'none') r.settings.maxPlayers = Math.max(r.settings.maxPlayers, r.seats.length);
    balanceTeams(r);
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:theme', (theme: BoardTheme | null, ack) => {
    const r = room();
    if (!r || !isHost(r) || r.status !== 'waiting') return reply(ack, { ok: false, error: 'Solo l’host può cambiare il tabellone' });
    r.theme = sanitizeTheme(theme);
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:addBot', (payload: { level: BotLevel }, ack) => {
    const r = room();
    if (!r || !isHost(r) || r.status !== 'waiting') return reply(ack, { ok: false, error: 'Solo l’host può aggiungere bot' });
    if (r.seats.length >= r.settings.maxPlayers) return reply(ack, { ok: false, error: 'La stanza è piena' });
    const level: BotLevel = ['easy', 'normal', 'hard'].includes(payload?.level) ? payload.level : 'normal';
    const usedNames = new Set(r.seats.map((s) => s.name));
    const name = `🤖 ${BOT_NAMES.find((n) => !usedNames.has(`🤖 ${n}`)) ?? 'Bot'}`;
    const profile = sanitizeProfile({ name, color: '', token: '' }, r, '');
    r.seats.push({ id: `bot-${newId()}`, ...profile, name, isBot: true, botLevel: level, connected: true });
    balanceTeams(r);
    systemChat(r, `Aggiunto ${name} (${BOT_LEVEL_LABEL[level]}).`, `Added ${name} (${level}).`);
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:kick', (payload: { id: string }, ack) => {
    const r = room();
    if (!r || !isHost(r) || r.status !== 'waiting' || payload?.id === clientId) return reply(ack, { ok: false });
    const seat = r.seats.find((s) => s.id === payload?.id);
    if (!seat) return reply(ack, { ok: false });
    r.seats = r.seats.filter((s) => s !== seat);
    if (!seat.isBot) io.to(`room:${r.id}`).emit('room:kicked', seat.id);
    systemChat(r, `${seat.name} è stato rimosso.`, `${seat.name} was removed.`);
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:team', (payload: { id: string; team: number }, ack) => {
    const r = room();
    if (!r || r.status !== 'waiting' || r.settings.teamMode === 'none') return reply(ack, { ok: false });
    const seat = r.seats.find((x) => x.id === payload?.id);
    const team = payload?.team === 1 ? 1 : 0;
    // The host arranges everybody; players can only switch themselves.
    if (!seat || (!isHost(r) && seat.id !== clientId)) return reply(ack, { ok: false });
    if (r.seats.filter((x) => x.team === team && x !== seat).length >= TEAM_SIZE[r.settings.teamMode])
      return reply(ack, { ok: false, error: 'Questa squadra è al completo' });
    seat.team = team;
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:start', (ack) => {
    const r = room();
    if (!r || !isHost(r) || r.status !== 'waiting') return reply(ack, { ok: false, error: 'Solo l’host può iniziare' });
    if (r.seats.length < 2) return reply(ack, { ok: false, error: 'Servono almeno 2 giocatori' });
    if (r.settings.teamMode !== 'none') {
      const size = TEAM_SIZE[r.settings.teamMode];
      balanceTeams(r);
      if ([0, 1].some((t) => r.seats.filter((x) => x.team === t).length !== size))
        return reply(ack, { ok: false, error: `Servono ${size} giocatori per squadra` });
    }
    const state = createGame({ id: r.id, settings: r.settings, seats: r.seats, now: Date.now(), theme: r.theme });
    r.status = 'playing';
    stats.gamesStarted++;
    r.runner = new GameRunner(state, (s) => {
      io.to(`room:${r.id}`).emit('game:state', s);
      if (s.phase === 'over' && r.status !== 'finished') {
        r.status = 'finished';
        stats.gamesFinished++;
        broadcastRoom(r);
      }
    });
    for (const seat of r.seats) if (!seat.isBot && !seat.connected) markDisconnected(r, seat);
    r.runner.start();
    io.to(`room:${r.id}`).emit('game:state', state);
    systemChat(r, 'La partita è iniziata!', 'The game has started!');
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('room:rematch', (ack) => {
    const r = room();
    if (!r || !isHost(r) || r.status !== 'finished') return reply(ack, { ok: false });
    r.runner?.stop();
    r.runner = null;
    r.status = 'waiting';
    r.seats = r.seats.filter((s) => s.isBot || s.connected);
    io.to(`room:${r.id}`).emit('game:state', null);
    systemChat(r, 'Nuova partita: tornate in sala d’attesa!', 'New game: back to the waiting room!');
    broadcastRoom(r);
    reply(ack, { ok: true });
  });

  socket.on('game:action', (action: Action, ack) => {
    const r = room();
    if (!r?.runner) return reply(ack, { ok: false, error: 'Nessuna partita in corso' });
    if (!r.seats.some((s) => s.id === clientId && !s.isBot)) return reply(ack, { ok: false, error: 'Sei uno spettatore' });
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return reply(ack, { ok: false, error: 'Azione non valida' });
    r.runner.autopilot.delete(clientId);
    reply(ack, r.runner.dispatch(clientId, action));
  });

  socket.on('chat:send', (text: string) => {
    const r = room();
    const seat = r?.seats.find((s) => s.id === clientId);
    const body = filterText(clean(text, 240));
    if (!r || !body) return;
    const msg: ChatMessage = {
      id: ++r.chatSeq,
      from: clientId,
      name: seat?.name ?? 'Spettatore',
      color: seat?.color ?? '#999',
      text: body,
      at: Date.now(),
    };
    r.chat.push(msg);
    if (r.chat.length > 100) r.chat.shift();
    io.to(`room:${r.id}`).emit('chat:msg', msg);
  });

  socket.on('disconnect', () => {
    const r = room();
    const seat = r?.seats.find((s) => s.id === clientId);
    if (!r || !seat) return;
    // Another tab of the same client may still be connected.
    const peers = io.sockets.adapter.rooms.get(`room:${r.id}`) ?? new Set<string>();
    const stillHere = [...peers].some((sid) => sid !== socket.id && io.sockets.sockets.get(sid)?.data.clientId === clientId);
    if (stillHere) return;
    if (r.status === 'waiting') {
      seat.connected = false;
      // A host who stays away blocks everyone: hand the room to someone who is online.
      setTimeout(() => {
        if (!seat.connected && r.hostId === seat.id && r.status === 'waiting' && rooms.has(r.id)) {
          const next = r.seats.find((s) => !s.isBot && s.connected);
          if (next) {
            r.hostId = next.id;
            systemChat(r, `${next.name} è il nuovo host.`, `${next.name} is the new host.`);
            broadcastRoom(r);
          }
        }
      }, 5_000);
      setTimeout(() => {
        if (!seat.connected && r.status === 'waiting' && rooms.has(r.id)) {
          r.seats = r.seats.filter((s) => s !== seat);
          if (!r.seats.some((s) => !s.isBot)) return deleteRoom(r);
          if (r.hostId === seat.id) r.hostId = (r.seats.find((s) => !s.isBot && s.connected) ?? r.seats.find((s) => !s.isBot))!.id;
          broadcastRoom(r);
        }
      }, 15_000);
    } else {
      markDisconnected(r, seat);
    }
    broadcastRoom(r);
  });
});

// ---------------------------------------------------------------- static

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/api/config', (_req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json(siteConfig);
});
app.get('/api/stats', (_req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ ...stats, online: io.engine.clientsCount, rooms: rooms.size, playing: [...rooms.values()].filter((r) => r.status === 'playing').length });
});

// ---------------------------------------------------------------- search engines

/** Public address of the site as the visitor sees it (custom domain or onrender.com). */
const siteOrigin = (req: express.Request) => {
  const host = req.get('x-forwarded-host') ?? req.get('host') ?? 'localhost';
  const proto = req.get('x-forwarded-proto')?.split(',')[0] ?? (/^localhost|^127\./.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
};

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteOrigin(req)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n`,
  );
});

const SEO_TITLE = 'Metropoly — Online property trading game | Gioco di proprietà online';
const SEO_DESC =
  'Free online board game: buy businesses, build hotels and bankrupt your rivals. Play with friends or bots, 2v2 and 3v3 teams. Gioco da tavolo gratis online con amici o bot.';

/** Head tags and crawler-readable text for the website (portal builds never pass through here). */
function seoHtml(html: string, origin: string) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'Metropoly',
    url: `${origin}/`,
    image: `${origin}/og-image.jpg`,
    description: SEO_DESC,
    genre: ['Board game', 'Strategy'],
    playMode: ['MultiPlayer', 'SinglePlayer'],
    applicationCategory: 'Game',
    operatingSystem: 'Web browser',
    inLanguage: ['en', 'it'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
  const head = `
    <link rel="canonical" href="${origin}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Metropoly" />
    <meta property="og:title" content="${SEO_TITLE}" />
    <meta property="og:description" content="${SEO_DESC}" />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:image" content="${origin}/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify(ld)}</script>
  `;
  const intro = `<main class="seo-intro"><h1>Metropoly</h1><p>${SEO_DESC}</p>
    <p>Roll the dice, buy businesses from hot dog stands to AI labs, complete color sets, build houses and hotels, hold live auctions and trade with other players. Lancia i dadi, compra attività, costruisci case e hotel, fai aste e scambi con gli altri giocatori.</p></main>`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${SEO_TITLE}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${SEO_DESC}" />`)
    .replace('</head>', `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${intro}</div>`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../dist/client');
if (existsSync(root)) {
  const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
  const sendIndex = (req: express.Request, res: express.Response) => res.type('html').send(seoHtml(indexHtml, siteOrigin(req)));
  app.get('/', sendIndex);
  app.use(express.static(root, { index: false }));
  app.get('*', sendIndex);
}

http.listen(PORT, () => console.log(`Metropoly server su http://localhost:${PORT}`));
