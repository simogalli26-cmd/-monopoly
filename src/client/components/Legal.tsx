import type { ReactNode } from 'react';
import { useSiteConfig } from '../site';

function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="home legal">
      <header className="home-header">
        <button className="btn ghost" onClick={onBack}>
          ← Lobby
        </button>
        <h1 className="page-title">{title}</h1>
        <span />
      </header>
      <article className="card legal-body">{children}</article>
    </div>
  );
}

export function Privacy({ onBack }: { onBack: () => void }) {
  const cfg = useSiteConfig();
  const who = cfg.owner || 'il gestore di Metropoly';
  return (
    <Page title="Privacy" onBack={onBack}>
      <p className="muted">Ultimo aggiornamento: ottobre 2026</p>
      <h2>Chi gestisce il sito</h2>
      <p>
        Il titolare del trattamento è {who}
        {cfg.contactEmail && (
          <>
            , contattabile all’indirizzo <a href={`mailto:${cfg.contactEmail}`}>{cfg.contactEmail}</a>
          </>
        )}
        .
      </p>
      <h2>Quali dati usiamo</h2>
      <ul>
        <li>
          <b>Nickname, pedina e colore</b> che scegli: servono per mostrarti agli altri giocatori durante la partita.
        </li>
        <li>
          <b>Messaggi di chat</b>: vengono inviati agli altri giocatori della stanza e restano in memoria solo finché la stanza esiste.
        </li>
        <li>
          <b>Un identificativo anonimo</b> generato dal tuo browser, per farti rientrare nella partita se perdi la connessione.
        </li>
        <li>
          <b>Dati tecnici</b> (indirizzo IP, tipo di browser) trattati dal fornitore di hosting per far funzionare il servizio e per sicurezza.
        </li>
      </ul>
      <p>Non chiediamo email, nomi reali o dati di pagamento e non creiamo profili pubblicitari.</p>
      <h2>Dati salvati sul tuo dispositivo</h2>
      <p>
        Usiamo il <i>local storage</i> del browser (non cookie di tracciamento) per ricordare il tuo profilo, le impostazioni, i suoni e i tabelloni
        che crei. Puoi cancellarli in qualsiasi momento dalle impostazioni del browser.
      </p>
      <h2>Portali di giochi</h2>
      <p>
        Se giochi a Metropoly dentro un portale (come CrazyGames o Poki), il portale può mostrare pubblicità e usare cookie secondo la propria
        informativa privacy, che ti invitiamo a leggere.
      </p>
      <h2>Per quanto tempo</h2>
      <p>Le partite e le chat non vengono salvate in modo permanente: spariscono quando la stanza viene chiusa o il server si riavvia.</p>
      <h2>I tuoi diritti</h2>
      <p>
        Puoi chiedere accesso, cancellazione o informazioni sui tuoi dati scrivendo al titolare. Hai anche il diritto di presentare reclamo al
        Garante per la protezione dei dati personali.
      </p>
      <h2>Minori</h2>
      <p>Il gioco è adatto a tutti; non raccogliamo consapevolmente dati personali dei minori oltre a quanto descritto sopra.</p>
    </Page>
  );
}

export function Terms({ onBack }: { onBack: () => void }) {
  return (
    <Page title="Termini di utilizzo" onBack={onBack}>
      <p className="muted">Ultimo aggiornamento: ottobre 2026</p>
      <h2>Il servizio</h2>
      <p>
        Metropoly è un gioco gratuito di compravendita di proprietà, giocabile online con altre persone o contro il computer. È un gioco indipendente,
        non affiliato né approvato da alcun produttore di giochi da tavolo. Il denaro del gioco è virtuale e non ha alcun valore reale.
      </p>
      <h2>Comportamento</h2>
      <ul>
        <li>Sii rispettoso: niente insulti, contenuti offensivi, spam o nickname inappropriati in chat, nei nomi o nei tabelloni condivisi.</li>
        <li>Non provare a manomettere il gioco, il server o le partite degli altri.</li>
        <li>L’host di una stanza può rimuovere i partecipanti prima dell’inizio della partita.</li>
      </ul>
      <h2>Tabelloni personalizzati</h2>
      <p>
        Sei responsabile dei testi che inserisci nei tuoi tabelloni e nei link che condividi. Non usare marchi, nomi o contenuti di altri senza averne
        il diritto.
      </p>
      <h2>Disponibilità</h2>
      <p>
        Il servizio è offerto “così com’è”: può essere interrotto, modificato o riavviato in qualsiasi momento, con la possibile perdita delle partite
        in corso.
      </p>
      <h2>Contributi volontari</h2>
      <p>
        Eventuali donazioni o acquisti di contenuti estetici sono volontari e servono a sostenere lo sviluppo. Non danno vantaggi nelle partite.
      </p>
    </Page>
  );
}

export function Footer({ onNav }: { onNav: (route: string) => void }) {
  const cfg = useSiteConfig();
  return (
    <footer className="site-footer">
      <nav>
        {cfg.supportUrl && (
          <a href={cfg.supportUrl} target="_blank" rel="noopener noreferrer">
            ❤️ Supporta Metropoly
          </a>
        )}
        <button onClick={() => onNav('/editor')}>🎨 Tabelloni</button>
        <a href={cfg.issuesUrl} target="_blank" rel="noopener noreferrer">
          🐞 Segnala un problema
        </a>
        <button onClick={() => onNav('/privacy')}>Privacy</button>
        <button onClick={() => onNav('/termini')}>Termini</button>
      </nav>
      <small className="muted">Metropoly è un gioco indipendente, non affiliato ad alcun marchio di giochi da tavolo.</small>
    </footer>
  );
}
