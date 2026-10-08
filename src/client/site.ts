import { useEffect, useState } from 'react';

export interface SiteConfig {
  supportUrl: string;
  contactEmail: string;
  issuesUrl: string;
  owner: string;
}

const DEFAULT: SiteConfig = {
  supportUrl: '',
  contactEmail: '',
  issuesUrl: 'https://github.com/simogalli26-cmd/-monopoly/issues',
  owner: '',
};

let cache: Promise<SiteConfig> | null = null;

/** Base address of the game server (same origin on the website, full URL in portal builds). */
export const serverBase = () => ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? '').replace(/\/$/, '');

export function loadSiteConfig(): Promise<SiteConfig> {
  cache ||= fetch(`${serverBase()}/api/config`)
    .then((r) => (r.ok ? r.json() : DEFAULT))
    .then((c) => ({ ...DEFAULT, ...c }))
    .catch(() => DEFAULT);
  return cache;
}

export function useSiteConfig(): SiteConfig {
  const [cfg, setCfg] = useState(DEFAULT);
  useEffect(() => {
    loadSiteConfig().then(setCfg);
  }, []);
  return cfg;
}

export const businessMailto = (email: string) =>
  `mailto:${email}?subject=${encodeURIComponent('Tabellone Metropoly personalizzato')}&body=${encodeURIComponent(
    'Ciao! Vorrei un tabellone personalizzato.\n\nOccasione (azienda, evento, scuola, festa…):\nNumero di giocatori:\nData:\nIdee per le caselle:\n',
  )}`;
