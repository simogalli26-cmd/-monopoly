import { setLang, useLang } from '../i18n';

export function LangToggle() {
  const lang = useLang();
  return (
    <button
      className="icon-btn lang-btn"
      onClick={() => setLang(lang === 'it' ? 'en' : 'it')}
      title={lang === 'it' ? 'Switch to English' : 'Passa all’italiano'}
      aria-label={lang === 'it' ? 'Switch to English' : 'Passa all’italiano'}
    >
      {lang === 'it' ? '🇬🇧' : '🇮🇹'}
    </button>
  );
}
