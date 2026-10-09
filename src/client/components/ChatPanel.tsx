import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/protocol';
import { useLang, useT } from '../i18n';

interface Props {
  messages: ChatMessage[];
  onSend: (t: string) => void;
  me: string | null;
}

const QUICK = ['👍', '😂', '😱', '🔥', 'GG!', '🤝?'];

export function ChatPanel({ messages, onSend, me }: Props) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = (t: string) => {
    if (!t.trim()) return;
    onSend(t.trim());
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={list}>
        {messages.length === 0 && <p className="muted small">{t('Nessun messaggio. Saluta gli altri giocatori!', 'No messages yet. Say hi to the other players!')}</p>}
        {messages.map((m) =>
          m.system ? (
            <div key={m.id} className="chat-sys">
              {lang === 'en' && m.en ? m.en : m.text}
            </div>
          ) : (
            <div key={m.id} className={`chat-msg ${m.from === me ? 'mine' : ''}`}>
              <b style={{ color: m.color }}>{m.name}</b> <span>{m.text}</span>
            </div>
          ),
        )}
      </div>
      <div className="chat-quick">
        {QUICK.map((q) => (
          <button key={q} onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input value={text} maxLength={240} placeholder={t('Scrivi un messaggio…', 'Type a message…')} onChange={(e) => setText(e.target.value)} />
        <button className="btn small" aria-label={t('Invia', 'Send')}>
          ➤
        </button>
      </form>
    </div>
  );
}
