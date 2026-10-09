import { useCallback, useSyncExternalStore } from 'react';
import { translateMessage, type Lang } from '../shared/i18n';
import type { LogEntry } from '../shared/types';
import { loadPref, savePref } from './profile';

const detect = (): Lang => {
  const saved = loadPref('lang', '');
  if (saved === 'it' || saved === 'en') return saved;
  return (navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en';
};

let lang: Lang = detect();
const listeners = new Set<() => void>();

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  savePref('lang', l);
  document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}

document.documentElement.lang = lang;

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const useLang = () => useSyncExternalStore(subscribe, getLang, getLang);

/** `t('Italiano', 'English')` — inline translations keep both texts next to each other. */
export function useT() {
  const l = useLang();
  return useCallback((it: string, en: string) => (l === 'en' ? en : it), [l]);
}

/** Non-hook variant for code outside components. */
export const tr = (it: string, en: string) => (lang === 'en' ? en : it);

/** Translates an error/message coming from the engine or the server. */
export const msg = (m: string | undefined) => translateMessage(lang, m);

export const logText = (l: LogEntry, current: Lang) => (current === 'en' && l.en ? l.en : l.text);
