# Metropoly 🏙️

Gioco di proprietà multiplayer online: compra attività, costruisci, fai aste e scambi con gli amici o contro i bot. Gioco indipendente, non affiliato ad alcun marchio di giochi da tavolo.

## Funzionalità

- **Modalità a squadre 2 vs 2 e 3 vs 3** (online e contro i bot): turni alternati, niente affitto tra compagni, gruppi di colore completati in squadra, beni del compagno in bancarotta che restano alla squadra, vince l'ultima squadra in gioco.

- **Editor di tabelloni personalizzati** (`#/editor`): nomi, icone, luoghi e nomi dei gruppi di tutte le caselle, modelli pronti (classico, ufficio, la mia città), anteprima dal vivo, link di condivisione e uso nelle stanze online.
- **Pronto per i portali di giochi** (CrazyGames, Poki): pubblicità solo nelle pause naturali, inviti nativi alle stanze.
- **Pagine del sito**: privacy, termini, segnalazione problemi, pulsante “Supporta”, sezione per aziende ed eventi, contatore dei giocatori online.

- **Tabellone di attività**: ogni proprietà è un'attività generica (chiosco hot dog, fast food, caffetteria, bowling, cinema, sneaker shop, telefonia, megastore di elettronica, palestra, spa, studio videogiochi, data center, laboratorio AI, resort, agenzia spaziale…) con icona e città sede, raggruppate in 8 settori. Nessun marchio reale.

- **Lobby in tempo reale**: stanze pubbliche e private, gioco rapido, ingresso con codice o link d'invito, spettatori.
- **Multiplayer online** (Socket.IO) da 2 a 8 giocatori, chat con reazioni rapide, riconnessione automatica.
- **Partite contro i bot** anche offline, nel browser: 3 livelli di difficoltà. I bot comprano, partecipano alle aste, costruiscono, ipotecano, valutano e propongono scambi.
- **Aste in tempo reale**: se non compri, la proprietà va all'asta; ogni offerta allunga il timer.
- **Scambi completi**: proprietà, contanti e carte “esci di prigione”, con accetta / rifiuta / controproposta.
- **Debiti gestiti**: se non hai contanti puoi vendere edifici o ipotecare prima di finire in bancarotta.
- **Regole personalizzabili**: soldi iniziali, affitto doppio sul gruppo completo, aste, montepremi all'Area Relax, Partenza doppia, niente affitti in prigione, costruzione uniforme, ordine casuale, tempo per mossa, durata asta.
- **Timer di turno e pilota automatico** per chi è inattivo o si disconnette.
- **Interfaccia moderna**: tabellone responsive (desktop e mobile), pedine animate casella per casella, dadi 3D, carte animate, variazioni di denaro, patrimonio netto, suoni (disattivabili), scorciatoia `Spazio` per tirare / finire il turno.
- Classifica finale e **rivincita** con un clic.

## Avvio

Richiede Node.js 20+.

```bash
npm install
npm run dev        # server su :3001 + client Vite su http://localhost:5173
```

Produzione:

```bash
npm run build      # typecheck + build del client in dist/client
npm start          # serve client e server su http://localhost:3001 (PORT configurabile)
```

Oppure con Docker:

```bash
docker build -t metropoly .
docker run -p 3001:3001 metropoly
```

Test del motore di gioco (incluse partite complete simulate tra bot):

```bash
npm test
```

## Struttura

```
src/shared/   motore di gioco puro e deterministico (condiviso da server e browser)
  board.ts    tabellone, carte, impostazioni predefinite
  engine.ts   regole: applyAction(state, player, action) → nuovo stato
  bot.ts      intelligenza artificiale dei bot
  runner.ts   ciclo di gioco: bot, aste, timer
src/server/   server Express + Socket.IO (lobby, stanze, chat)
src/client/   app React (lobby, sala d'attesa, partita)
tests/        test Vitest
```

Il server è autoritativo: i client inviano azioni, il server le valida con il motore e invia lo stato aggiornato a tutti.

## Pubblicazione online

Il gioco ha bisogno di un server Node sempre acceso (usa WebSocket), quindi **non** va su hosting solo statici come GitHub Pages, Netlify o Vercel.

**Render (gratuito, consigliato)**
1. Crea un account su [render.com](https://render.com) e collega GitHub.
2. *New → Blueprint* e scegli questo repository: il file `render.yaml` configura tutto da solo.
3. Dopo qualche minuto il gioco è online su `https://metropoly-xxxx.onrender.com`.

Nel piano gratuito il server si “addormenta” dopo 15 minuti senza visite: la prima apertura può richiedere ~30 secondi.

**Alternative**: Railway o Fly.io (usano il `Dockerfile`), oppure una VPS qualsiasi con `npm install && npm run build && npm start`.

## Configurazione (variabili d'ambiente)

| Variabile | A cosa serve |
|---|---|
| `SUPPORT_URL` | Link per le donazioni (Ko-fi, PayPal.me, Stripe Payment Link). Se vuota, il pulsante “Supporta” non compare. |
| `CONTACT_EMAIL` | Email per le richieste di tabelloni su misura e per la pagina privacy. |
| `OWNER_NAME` | Nome del titolare mostrato nella pagina privacy. |
| `PORT` | Porta del server (Render la imposta da solo). |

Su Render: servizio → **Environment** → **Add Environment Variable**.

Statistiche in tempo reale: `/api/stats` (partite iniziate/finite, giocatori online, picco).

## Pubblicare su CrazyGames / Poki

1. Ogni push su GitHub esegue i test e prepara la build per i portali (GitHub → **Actions** → ultimo run → artifact **metropoly-portal**): è un unico `index.html` con tutto il gioco e lo script dell'SDK CrazyGames. In locale: `npm run build:portal` (cartella `dist/portal`).
2. La build si collega al server indicato in `.env.portal` (`VITE_SERVER_URL`).
3. Carica lo zip della cartella sul portale. L'adattatore `src/client/platform.ts` attiva l'SDK del portale quando il gioco gira dentro il portale (o con `?platform=crazygames` / `?platform=poki`) e mostra la pubblicità solo prima di una nuova partita, di una rivincita o all'uscita a fine partita.

Prima di pubblicare su un portale è consigliato un piano Render a pagamento, così il server non va in pausa.
