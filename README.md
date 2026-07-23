# gianmarcoaltieri.com

Sito personale — statico, bilingue (IT/EN), nessuna dipendenza da installare. Pubblicato via GitHub Pages: ogni push su `master` aggiorna automaticamente il sito live.

## Struttura
- `index.html` — markup e contenuti (chiavi `data-i18n` per le traduzioni)
- `assets/css/style.css` — stile
- `assets/js/content.js` — testi IT/EN
- `assets/js/main.js` — animazioni, cursore, contatori, switch lingua/tema
- `assets/img/portrait.jpg` — foto profilo
- `CNAME` — dominio custom per GitHub Pages, non toccare
- `.nojekyll` — disabilita il build Jekyll di default di GitHub Pages (il sito è già statico)

## Anteprima locale
```
python3 -m http.server 8080
```
poi apri http://localhost:8080

## Modificare i contenuti
Tutti i testi (IT/EN) sono in `assets/js/content.js`, organizzati per sezione. Basta modificare le stringhe lì — l'HTML referenzia le chiavi tramite `data-i18n`.

## Pubblicare una modifica
```
git add -A
git commit -m "descrizione della modifica"
git push origin master
```
GitHub Pages rebuilda in automatico (di solito entro 1-2 minuti).
