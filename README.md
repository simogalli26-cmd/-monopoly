# Metropoly 🏙️

Gioco di proprietà multiplayer online ispirato a Monopoly (e a siti come monopoly-game.io), con grafica rinnovata e meccaniche migliorate.

## Funzionalità

- **Lobby in tempo reale**: stanze pubbliche e private, gioco rapido, ingresso con codice o link d'invito, spettatori.
- **Multiplayer online** (Socket.IO) da 2 a 8 giocatori, chat con reazioni rapide, riconnessione automatica.
- **Partite contro i bot** anche offline, nel browser: 3 livelli di difficoltà. I bot comprano, partecipano alle aste, costruiscono, ipotecano, valutano e propongono scambi.
- **Aste in tempo reale**: se non compri, la proprietà va all'asta; ogni offerta allunga il timer.
- **Scambi completi**: proprietà, contanti e carte “esci di prigione”, con accetta / rifiuta / controproposta.
- **Debiti gestiti**: se non hai contanti puoi vendere edifici o ipotecare prima di finire in bancarotta.
- **Regole personalizzabili**: soldi iniziali, affitto doppio sul gruppo completo, aste, montepremi al Parcheggio, VIA doppio, niente affitti in prigione, costruzione uniforme, ordine casuale, tempo per mossa, durata asta.
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
