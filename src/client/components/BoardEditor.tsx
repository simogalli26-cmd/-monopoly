import { useMemo, useRef, useState } from 'react';
import { BOARD, DEFAULT_SETTINGS, GROUP_COLORS, GROUP_MEMBERS } from '../../shared/board';
import { createGame } from '../../shared/engine';
import { MAX_NAME, MAX_SHORT, MAX_TITLE, decodeTheme, encodeTheme, groupLabel, nameOf, sanitizeTheme, type BoardTheme } from '../../shared/theme';
import type { Group } from '../../shared/types';
import { EMOJI_PALETTE, TEMPLATES, deleteBoard, listBoards, saveBoard } from '../boards';
import { Board } from './Board';
import { tr, useLang, useT } from '../i18n';
import { toast } from './Toasts';

const GROUP_ORDER: Group[] = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'airport', 'utility'];

function usePreviewState(theme: BoardTheme) {
  const key = JSON.stringify(theme);
  return useMemo(
    () =>
      createGame({
        id: 'preview',
        settings: { ...DEFAULT_SETTINGS, randomOrder: false },
        seats: [],
        theme,
        now: 0,
        seed: 1,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}

export function BoardPreview({ theme, onTile }: { theme: BoardTheme; onTile?: (i: number) => void }) {
  const state = usePreviewState(theme);
  return (
    <Board
      state={state}
      positions={{}}
      onTile={onTile ?? (() => {})}
      center={
        <div className="center-inner">
          <div className="brand">
            Metro<b>poly</b>
          </div>
          <p className="preview-title">{theme.title}</p>
        </div>
      }
    />
  );
}

export const shareLink = (b: BoardTheme) => `${window.location.origin}${window.location.pathname}#/board/${encodeTheme(b)}`;

export async function copyShareLink(b: BoardTheme) {
  const link = shareLink(b);
  try {
    if (navigator.share) await navigator.share({ title: `Metropoly — ${b.title}`, url: link });
    else {
      await navigator.clipboard.writeText(link);
      toast(tr('Link copiato! Chi lo apre può giocare con il tuo tabellone.', 'Link copied! Anyone who opens it can play on your board.'), 'success');
    }
  } catch {
    /* share sheet dismissed */
  }
}

// ---------------------------------------------------------------- list

export function BoardList({ onEdit, onBack, onPlay }: { onEdit: (id: string) => void; onBack: () => void; onPlay: (b: BoardTheme) => void }) {
  const t = useT();
  const lang = useLang();
  const [boards, setBoards] = useState(listBoards);
  const create = (b: BoardTheme) => {
    saveBoard(b);
    onEdit(b.id);
  };
  return (
    <div className="home editor-page">
      <header className="home-header">
        <button className="btn ghost" onClick={onBack}>
          ← Lobby
        </button>
        <h1 className="page-title">🎨 {t('I miei tabelloni', 'My boards')}</h1>
        <span />
      </header>

      <section className="card">
        <h2>{t('Crea un nuovo tabellone', 'Create a new board')}</h2>
        <p className="muted">
          {t(
            'Cambia nomi, icone e luoghi di tutte le caselle: la tua città, il tuo ufficio, le battute del tuo gruppo di amici. Le regole e i prezzi restano gli stessi.',
            'Change the names, icons and places of every space: your town, your office, your friends’ inside jokes. Rules and prices stay the same.',
          )}
        </p>
        <div className="template-grid">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.title[0]} className="template" onClick={() => create(tpl.build(lang))}>
              <b>{t(...tpl.title)}</b>
              <small className="muted">{t(...tpl.description)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t('Salvati su questo dispositivo', 'Saved on this device')}</h2>
        {boards.length === 0 && <p className="muted">{t('Ancora nessun tabellone. Parti da un modello qui sopra!', 'No boards yet. Start from a template above!')}</p>}
        <ul className="board-list">
          {boards.map((b) => (
            <li key={b.id} className="board-item">
              <div>
                <b>{b.title}</b>
                <small className="muted">
                  {Object.values(b.spaces)
                    .slice(0, 6)
                    .map((s) => s.icon)
                    .join(' ')}
                </small>
              </div>
              <div className="row">
                <button className="btn small primary" onClick={() => onPlay(b)}>
                  ▶ {t('Gioca', 'Play')}
                </button>
                <button className="btn small" onClick={() => onEdit(b.id)}>
                  ✏️ {t('Modifica', 'Edit')}
                </button>
                <button className="btn small" onClick={() => copyShareLink(b)}>
                  🔗 {t('Condividi', 'Share')}
                </button>
                <button
                  className="icon-btn"
                  aria-label={t('Elimina', 'Delete')}
                  onClick={() => {
                    if (!confirm(t(`Eliminare “${b.title}”?`, `Delete “${b.title}”?`))) return;
                    deleteBoard(b.id);
                    setBoards(listBoards());
                  }}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- editor

export function BoardEditor({ id, onBack, onPlay }: { id: string; onBack: () => void; onPlay: (b: BoardTheme) => void }) {
  const initial = listBoards().find((b) => b.id === id);
  const [board, setBoard] = useState<BoardTheme | null>(initial ?? null);
  const [saved, setSaved] = useState(true);
  const [picker, setPicker] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLInputElement>());
  const touchedShort = useRef(new Set<number>());
  const t = useT();
  const lang = useLang();

  if (!board)
    return (
      <div className="center-screen">
        <div className="card narrow">
          <p>{t('Tabellone non trovato.', 'Board not found.')}</p>
          <button className="btn primary" onClick={onBack}>
            {t('Torna ai tabelloni', 'Back to boards')}
          </button>
        </div>
      </div>
    );

  const update = (b: BoardTheme) => {
    setBoard(b);
    setSaved(false);
  };
  const setSpace = (i: number, patch: Partial<BoardTheme['spaces'][number]>) =>
    update({ ...board, spaces: { ...board.spaces, [i]: { ...(board.spaces[i] ?? { name: BOARD[i].name }), ...patch } } });
  const save = () => {
    const clean = sanitizeTheme(board)!;
    saveBoard(clean);
    setBoard(clean);
    setSaved(true);
    toast(tr('Tabellone salvato', 'Board saved'), 'success');
    return clean;
  };
  const focusRow = (i: number) => {
    const el = rows.current.get(i);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  };

  return (
    <div className="editor">
      <header className="game-header">
        <button
          className="btn small ghost"
          onClick={() => {
            if (!saved && !confirm(t('Uscire senza salvare le modifiche?', 'Leave without saving your changes?'))) return;
            onBack();
          }}
        >
          ← {t('Tabelloni', 'Boards')}
        </button>
        <input
          className="title-input"
          value={board.title}
          maxLength={MAX_TITLE}
          onChange={(e) => update({ ...board, title: e.target.value })}
          aria-label={t('Nome del tabellone', 'Board name')}
        />
        <div className="header-actions">
          <button className="btn small" onClick={() => copyShareLink(saved ? board : save())}>
            🔗 {t('Condividi', 'Share')}
          </button>
          <button className="btn small" onClick={() => onPlay(saved ? board : save())}>
            ▶ {t('Prova', 'Try it')}
          </button>
          <button className="btn small primary" disabled={saved} onClick={save}>
            {saved ? `✓ ${t('Salvato', 'Saved')}` : t('Salva', 'Save')}
          </button>
        </div>
      </header>

      <div className="editor-grid">
        <div className="editor-form">
          <p className="muted small">{t('Tocca una casella nell’anteprima per modificarla. Prezzi e regole non cambiano.', 'Tap a space in the preview to edit it. Prices and rules don’t change.')}</p>
          {GROUP_ORDER.map((g) => (
            <section key={g} className="ed-group" style={{ ['--group' as string]: GROUP_COLORS[g] }}>
              <div className="ed-group-head">
                <i className="pick-color" />
                <input
                  value={board.groups[g] ?? ''}
                  placeholder={groupLabel(null, g, lang)}
                  maxLength={24}
                  onChange={(e) => update({ ...board, groups: { ...board.groups, [g]: e.target.value } })}
                  aria-label={t('Nome del gruppo', 'Group name')}
                />
              </div>
              {GROUP_MEMBERS[g].map((i) => {
                const sp = board.spaces[i] ?? { name: BOARD[i].name, icon: BOARD[i].icon };
                return (
                  <div key={i} className="ed-row">
                    <button className="ed-icon" onClick={() => setPicker(picker === i ? null : i)} aria-label={t('Cambia icona', 'Change icon')}>
                      {sp.icon || BOARD[i].icon}
                    </button>
                    <input
                      ref={(el) => {
                        if (el) rows.current.set(i, el);
                      }}
                      className="ed-name"
                      value={sp.name}
                      maxLength={MAX_NAME}
                      placeholder={nameOf(null, i, lang)}
                      onChange={(e) =>
                        // A renamed space gets an automatic short label unless the user typed one.
                        setSpace(i, touchedShort.current.has(i) ? { name: e.target.value } : { name: e.target.value, short: '' })
                      }
                      aria-label={t('Nome', 'Name')}
                    />
                    <input
                      className="ed-short"
                      value={sp.short ?? ''}
                      maxLength={MAX_SHORT}
                      placeholder={t('Nome breve', 'Short name')}
                      onChange={(e) => {
                        touchedShort.current.add(i);
                        setSpace(i, { short: e.target.value });
                      }}
                      aria-label={t('Nome breve sulla casella', 'Short name on the tile')}
                    />
                    <input
                      className="ed-city"
                      value={sp.city ?? ''}
                      maxLength={MAX_SHORT * 2}
                      placeholder={t('📍 Luogo', '📍 Place')}
                      onChange={(e) => setSpace(i, { city: e.target.value })}
                      aria-label={t('Luogo', 'Place')}
                    />
                    <span className="ed-price muted">${BOARD[i].price}</span>
                    {picker === i && (
                      <div className="emoji-pop">
                        {EMOJI_PALETTE.map((em) => (
                          <button
                            key={em}
                            onClick={() => {
                              setSpace(i, { icon: em });
                              setPicker(null);
                            }}
                          >
                            {em}
                          </button>
                        ))}
                        <input
                          placeholder={t('Altra emoji…', 'Other emoji…')}
                          maxLength={8}
                          onChange={(e) => e.target.value && setSpace(i, { icon: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <div className="editor-preview">
          <BoardPreview theme={board} onTile={(i) => (board.spaces[i] || GROUP_MEMBERS.airport.includes(i) || GROUP_MEMBERS.utility.includes(i) ? focusRow(i) : undefined)} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- import from link

export function BoardImport({ code, onDone, onPlay }: { code: string; onDone: () => void; onPlay: (b: BoardTheme) => void }) {
  const t = useT();
  const board = useMemo(() => decodeTheme(code), [code]);
  if (!board)
    return (
      <div className="center-screen">
        <div className="card narrow">
          <p>{t('Questo link non contiene un tabellone valido.', 'This link doesn’t contain a valid board.')}</p>
          <button className="btn primary" onClick={onDone}>
            {t('Vai alla lobby', 'Go to the lobby')}
          </button>
        </div>
      </div>
    );
  return (
    <div className="home editor-page">
      <header className="home-header">
        <button className="btn ghost" onClick={onDone}>
          ← Lobby
        </button>
        <h1 className="page-title">🎁 {t('Ti hanno condiviso un tabellone', 'Someone shared a board with you')}</h1>
        <span />
      </header>
      <section className="card import-card">
        <h2>{board.title}</h2>
        <div className="import-preview">
          <BoardPreview theme={board} />
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => onPlay(board)}>
            ▶ {t('Gioca contro i bot', 'Play vs bots')}
          </button>
          <button
            className="btn"
            onClick={() => {
              saveBoard({ ...board, id: `b${Date.now().toString(36)}` });
              toast(t('Salvato nei tuoi tabelloni: ora puoi usarlo anche nelle stanze online', 'Saved to your boards: you can now use it in online rooms too'), 'success');
              onDone();
            }}
          >
            💾 {t('Salva nei miei tabelloni', 'Save to my boards')}
          </button>
        </div>
      </section>
    </div>
  );
}
