/**
 * Thin adapter for web game portals (CrazyGames, Poki). On the normal website every call is a no-op,
 * so the game never depends on a portal SDK being present or loading correctly.
 *
 * Portal is picked with `?platform=crazygames|poki` (set it in the portal's game URL) or detected
 * from the embedding page.
 */

type PortalName = 'web' | 'crazygames' | 'poki';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    CrazyGames?: any;
    PokiSDK?: any;
  }
}

const SCRIPTS: Record<Exclude<PortalName, 'web'>, string> = {
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
};

function detect(): PortalName {
  const q = new URLSearchParams(window.location.search).get('platform');
  if (q === 'crazygames' || q === 'poki') return q;
  // The CrazyGames build ships the SDK script in index.html.
  if (window.CrazyGames?.SDK) return 'crazygames';
  const embedder = `${document.referrer} ${Array.from(window.location.ancestorOrigins ?? []).join(' ')}`;
  if (/crazygames\./.test(embedder)) return 'crazygames';
  if (/poki\.(com|io)|poki-gdn/.test(embedder)) return 'poki';
  return 'web';
}

export const portal: PortalName = detect();
/** Inside a game portal: no external links, no own promotions. */
export const isPortal = portal !== 'web';
let ready: Promise<boolean> | null = null;
let muteHandler: (muted: boolean) => void = () => {};

/** Lets the sound module mute itself while an ad is playing. */
export const onAdMute = (fn: (muted: boolean) => void) => (muteHandler = fn);

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`SDK non caricato: ${src}`));
    document.head.appendChild(s);
  });

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/** Loads and initialises the portal SDK once. Resolves to false on the plain website or on failure. */
export function initPortal(): Promise<boolean> {
  if (ready) return ready;
  if (portal === 'web') return (ready = Promise.resolve(false));
  ready = withTimeout(
    (async () => {
      try {
        const present = portal === 'crazygames' ? !!window.CrazyGames?.SDK : !!window.PokiSDK;
        if (!present) await loadScript(SCRIPTS[portal]);
        if (portal === 'crazygames') {
          await window.CrazyGames.SDK.init();
          window.CrazyGames.SDK.game.loadingStop?.();
        } else {
          await window.PokiSDK.init();
          window.PokiSDK.gameLoadingFinished?.();
        }
        return true;
      } catch (e) {
        console.warn(e);
        return false;
      }
    })(),
    8000,
    false,
  );
  return ready;
}

async function sdk(): Promise<any | null> {
  if (!(await initPortal())) return null;
  return portal === 'crazygames' ? window.CrazyGames?.SDK : window.PokiSDK;
}

let playing = false;

export async function gameplayStart() {
  if (playing) return;
  playing = true;
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.gameplayStart();
    else s?.gameplayStart();
  } catch {
    /* ignore */
  }
}

export async function gameplayStop() {
  if (!playing) return;
  playing = false;
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.gameplayStop();
    else s?.gameplayStop();
  } catch {
    /* ignore */
  }
}

/** A natural break (before a new game / rematch). The portal decides whether an ad really plays. */
export async function adBreak(): Promise<void> {
  const s = await sdk();
  if (!s) return;
  await withTimeout(
    new Promise<void>((resolve) => {
      try {
        if (portal === 'crazygames') {
          s.ad.requestAd('midgame', {
            adStarted: () => muteHandler(true),
            adFinished: () => resolve(),
            adError: () => resolve(),
          });
        } else {
          muteHandler(true);
          Promise.resolve(s.commercialBreak(() => muteHandler(true))).then(() => resolve(), () => resolve());
        }
      } catch {
        resolve();
      }
    }),
    45000,
    undefined,
  );
  muteHandler(false);
}

/** Celebrate a big moment (CrazyGames "happytime"). */
export async function happyTime() {
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.happytime?.();
  } catch {
    /* ignore */
  }
}

/** Invite link for an online room: the portal's own link when embedded, otherwise our site's. */
export async function roomInviteLink(roomId: string): Promise<string> {
  const fallback = `${window.location.origin}${window.location.pathname}#/room/${roomId}`;
  const s = await sdk();
  try {
    if (portal === 'crazygames' && s?.game.inviteLink) return (await s.game.inviteLink({ roomId })) || fallback;
    if (portal === 'poki' && s?.shareableURL) return (await s.shareableURL({ roomId })) || fallback;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Room id a player was invited to through a portal link, if any. */
export async function invitedRoom(): Promise<string | null> {
  const fromQuery = new URLSearchParams(window.location.search).get('roomId');
  const s = await sdk();
  try {
    if (portal === 'crazygames') return s?.game.getInviteParam?.('roomId') || fromQuery;
    if (portal === 'poki') return s?.getURLParam?.('roomId') || fromQuery;
  } catch {
    /* ignore */
  }
  return fromQuery;
}

/** CrazyGames native "invite friends" button for the current room (shown while in the lobby). */
export async function showInviteButton(roomId: string) {
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.showInviteButton?.({ roomId });
  } catch {
    /* ignore */
  }
}

export async function hideInviteButton() {
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.hideInviteButton?.();
  } catch {
    /* ignore */
  }
}

/** The player launched the game from the portal's "play with friends" button: open a lobby right away. */
export async function isInstantMultiplayer(): Promise<boolean> {
  const s = await sdk();
  try {
    return portal === 'crazygames' && !!s?.game.isInstantMultiplayer;
  } catch {
    return false;
  }
}

export interface PortalSettings {
  muteAudio: boolean;
  disableChat: boolean;
}

let portalSettings: PortalSettings = { muteAudio: false, disableChat: false };
const settingsListeners = new Set<(s: PortalSettings) => void>();

export const getPortalSettings = () => portalSettings;

export function onPortalSettings(fn: (s: PortalSettings) => void) {
  settingsListeners.add(fn);
  return () => void settingsListeners.delete(fn);
}

/** Reads the portal's player settings (mute audio, disable chat) and follows their changes. */
async function watchPortalSettings() {
  const s = await sdk();
  if (portal !== 'crazygames' || !s?.game) return;
  const read = () => {
    const g = s.game.settings ?? {};
    portalSettings = { muteAudio: !!g.muteAudio, disableChat: !!g.disableChat };
    settingsListeners.forEach((fn) => fn(portalSettings));
  };
  try {
    read();
    s.game.addSettingsChangeListener?.(read);
  } catch {
    /* ignore */
  }
}

void initPortal().then((ok) => {
  if (ok) void watchPortalSettings();
});

/** Tells CrazyGames which room the player is in and whether friends can still join it. */
export async function updateRoom(roomId: string, isJoinable: boolean) {
  const s = await sdk();
  try {
    if (portal === 'crazygames') {
      s?.game.updateRoom?.({ roomId, isJoinable, inviteParams: { roomId } });
      // Prepare the portal invite link for this room right away, so it is ready when the player shares it.
      if (isJoinable) await s?.game.inviteLink?.({ roomId });
    }
  } catch {
    /* ignore */
  }
}

export async function leftRoom() {
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.leftRoom?.();
  } catch {
    /* ignore */
  }
}

/** Called when the player accepts a friend's invite from the CrazyGames UI while already in the game. */
export async function onJoinRoomRequest(fn: (roomId: string) => void) {
  const s = await sdk();
  try {
    if (portal === 'crazygames') s?.game.addJoinRoomListener?.((p: { roomId?: string } | undefined) => p?.roomId && fn(String(p.roomId)));
  } catch {
    /* ignore */
  }
}
