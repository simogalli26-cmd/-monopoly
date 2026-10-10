# Kit di pubblicazione — Metropoly

Tutto quello che serve per inviare il gioco ai portali. I testi in inglese vanno copiati così come sono nei moduli.

## File

| File | Uso |
|---|---|
| `cover-1920x1080.png` | Copertina orizzontale (16:9) |
| `cover-800x1200.png` | Copertina verticale (2:3) |
| `cover-800x800.png` | Copertina quadrata (1:1) |
| `preview-gameplay.mp4` | Video di anteprima (30 s di partita reale) |
| Build del gioco | GitHub → **Actions** → ultimo run verde → artifact **metropoly-portal**: estrai lo zip e carica il solo file `index.html` (contiene tutto il gioco) |

## Testi (inglese)

**Title:** Metropoly

**Short description (1 line):**
Buy businesses, build hotels and bankrupt your rivals in this online property trading game.

**Description:**
Metropoly is a modern take on the classic property trading board game. Roll the dice, buy businesses from hot dog stands to AI labs, complete color sets, build houses and hotels, and collect rent until your rivals go bankrupt.

- Play online with friends in private rooms, or against smart bots (3 difficulty levels)
- Team modes: 2 vs 2 and 3 vs 3, with shared color sets and no rent between teammates
- Live auctions with a timer that extends on every bid
- Full trades: properties, cash and get-out-of-jail cards, with counter-offers
- Mortgages, debts and bankruptcy rules
- Custom house rules: starting cash, double rent on sets, jackpot, turn timer and more
- Board editor: create your own board with your town, office or friends and share it with a link
- Available in English and Italian

**Controls:**
Mouse / touch. Click "Roll the dice" to move, then buy, build or trade using the buttons. Space bar: roll / end turn.

**Category:** Board / Strategy · **Tags:** board game, multiplayer, strategy, trading, dice, family, 2 player, team, bots

**Supported devices:** Desktop, tablet, mobile (landscape and portrait).

## Passi per CrazyGames (dall'iPad)

1. Vai su **developer.crazygames.com** e crea un account sviluppatore.
2. **Submit a game** → tipo **HTML5**.
3. Carica lo zip della build (artifact `metropoly-portal` da GitHub Actions: scaricalo, è già uno zip).
4. Carica le 3 copertine e il video, incolla titolo, descrizioni e comandi qui sopra.
5. Alla domanda sul multiplayer: sì, online multiplayer con server proprio (rooms + invite links via SDK).
6. Invia. Il team di CrazyGames testa il gioco e risponde, di solito, in pochi giorni o settimane.

**Prima di inviare:** passa il servizio Render al piano a pagamento (circa 7 $/mese), altrimenti dopo 15 minuti di inattività il server si addormenta e il multiplayer impiega ~30 secondi ad avviarsi. La modalità contro i bot funziona comunque anche senza server.

## Altri portali dove caricare lo stesso pacchetto

- **GameDistribution** (gamedistribution.com/developers): distribuisce il gioco su migliaia di siti con pubblicità a ricavi condivisi. Richiede il loro SDK: chiedimi di aggiungerlo.
- **Poki** (developers.poki.com): più selettivo, si invia una candidatura. L'SDK è già integrato.
- **itch.io**: niente pubblicità, ma puoi mettere il gioco "a offerta libera". Carica lo zip come gioco HTML.
