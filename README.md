# Aaron & Josephine — Interactive Wedding Invitation

Static site (HTML + Tailwind + vanilla JS). No backend, no build needed to run.

The page is the printed invitation brought to life: one poster on the invitation's own 1065 × 1598 grid. On phones and tablets held upright the whole invitation fits the screen edge to edge with no scrolling; on large screens it is shown framed at full size. Live fireworks burst in the sky behind the couple and confetti falls on top.

**How the poster is built:** the artwork (scenery, gold title, hearts, "Wedding" script, rings, the date panel frame and icons, the guest card) is cut straight from the original invitation, so it matches it pixel for pixel. Every piece of **wording** is live text on top of that artwork, so it can be changed in one place (below). Fonts and positions were measured against the original.

## Run it

```bash
# any static server works
npx serve .
# or
python3 -m http.server 8080
```

Opening `index.html` directly also works, but share/copy links will be `file://` paths until it is hosted.

## Deploy (free)

**Vercel:** `npx vercel --prod` from this folder (no framework, output dir `.`).
**Netlify:** drag the folder onto app.netlify.com/drop.
After deploying, set `share.siteUrl` in `js/main.js` to the live URL.

## Edit wedding details — one place

Everything lives in `window.WEDDING_CONFIG` at the top of **`js/main.js`**.

| What | Key | Example |
|---|---|---|
| Date | `date` | `'Friday,\n1st January 2027'` (`\n` = line break) |
| Scripture under the title | `intro` | `'“Therefore what God\nhas joined together,…'` |
| The families (two emerald panels) | `families.label`, `families.joiner`, `families.groom`, `families.bride` | `'The Family of'`, `'and'` (gold medallion between them), `'Mr. Ssimbwa Moses\nand Mrs. …\nof Kitoma, …'` |
| Invitation lines | `inviteLine`, `matrimonyLine` | `'cordially invite the company of'` |
| Couple names | `couple.groom`, `couple.bride`, `couple.short` | `'Aaron'`, `'Josephine'`, `'Aaron & Josephine'` |
| Church service | `church.name`, `church.time`, `church.note`, `church.mapsQuery` | `'Rubaga Cathedral'`, `'12:00 PM'` |
| Reception | `reception.text`, `reception.venue`, `reception.time`, `reception.mapsQuery` | `'Thereafter, guests will\nproceed to {venue}\nstarting at {time}.'` |
| Colour theme badge | `colorTheme` | `'Color Theme: Emerald Green & Burgundy'` |
| Bottom line | `tagline` | `'Let’s celebrate love, …'` |
| RSVP | `rsvp.name`, `rsvp.phone`, `phoneCountryCode` | `'Nalubowa Dorothy'`, `'0771 008212'`, `'+256'` (tap to call) |
| Gold ribbon at the bottom | `footerRibbon` | `'Strictly by Invitation'` |
| Guest bar placeholder | `guest.label` | `'Mr./Mrs./Ms./Dr.'` (a personal link writes the guest's name there) |

`date: null` shows **"Date to be confirmed"**.

Longer wording is fine: each line has a maximum width (`data-maxw` in `index.html`) and shrinks automatically to stay inside its space.

## Personal guest links

```
https://your-site/?guest=John%20Mukasa
```
Writes the name on the *Names:* line of the guest card and greets them by name in the welcome banner.

**Link generator for the hosts:** open `https://your-site/?host` — a form appears at the bottom of the page that creates a personal link and a WhatsApp send button for each guest.

## Change photos

| File | Used for |
|---|---|
| `assets/art/poster.webp` | The emerald design with all wording and the design's stand-in couple removed |
| `assets/art/front.webp` | The "The Families of" panels, layered in front of the couple |
| `assets/couple/couple-layer.webp` | The original couple (Aaron & Josephine), layered in front of the fireworks |
| `assets/art/title.webp` | The gold "Wedding Invitation" title, layered in front of the fireworks |
| `assets/couple/couple-photo-original.jpg`, `couple-cutout.png` | The couple's "London save the date" photo and a cutout of it |
| `assets/couple/mark-and-mary-*` | Earlier placeholder couple (only used by `build-artwork-v1.js`) |
| `assets/share-card-v5.jpg` | Link-preview picture (1200×630) for WhatsApp, Facebook, X…: poster + names, date, time, venue |
| `favicon.ico`, `assets/icons/favicon.svg`, `favicon-32.png` | Browser-tab icon: two gold rings on navy (the SVG is the source; the others are made from it) |
| `assets/icons/apple-touch-icon.png` | Icon when the page is saved to an iPhone/iPad home screen |

The couple is part of the poster artwork (`tools/poster-build/reference.png`). To change the artwork, put the new design in `reference.png` and rebuild with `tools/poster-build/build-v5.js` and `fit-v5.js` (see its README). Then refresh `assets/share-card-v5.jpg`.

**Moving text on the poster:** each line in `index.html` has `style="--x:…;--y:…;--fs:…;--sx:…"`: position (poster pixels; for centred lines `--x` is the centre), font size, and horizontal squeeze. `tools/poster-build/` has the scripts that rebuilt the artwork and measured the text against the original (see its README).

**Link previews:** the `<head>` of `index.html` has the preview title, description and picture (`og:*` / `twitter:*`) plus the event's date and place (schema.org Event). They use the live address `https://aaronandjosephine.onrender.com/`; if the address changes, update it there and in `share.siteUrl` (js/main.js). If the wording, date or venue change, update these tags and the share card too, as previews don't run the page's JavaScript. After changing the picture, give it a new file name so WhatsApp and Facebook don't keep showing the old cached one.

## Controls

No buttons over the invitation: fireworks and confetti play automatically (turn them off for everyone with `fireworks.enabled` / `confetti.enabled` in the config). Tap the sky on the poster to launch a firework; tap the church or the reception venue to see its map (with directions) in a window over the invitation.
Visitors whose device asks for reduced motion get no fireworks or recurring confetti. Animations pause when the tab is hidden or the poster is off screen.

## Styling

Edit `src/input.css`, then rebuild `css/styles.css`:
```bash
npm install
npm run build:css      # or: npm run watch:css
```

## Files

```
index.html            page markup (Lucide icons inlined as an SVG sprite)
css/styles.css        compiled Tailwind + custom styles
src/input.css         stylesheet source
js/main.js            CONFIG + page wiring (guest, share, toggles)
js/fireworks.js       canvas fireworks inside the poster
js/confetti.js        welcome + recurring confetti
js/vendor/            canvas-confetti 1.9.3 (local copy, works offline)

tools/poster-build/   scripts that cut the artwork from the original and fit the text to it
```

Credits: fonts Google Fonts (Libre Caslon Text, Tinos, Great Vibes, Cormorant Garamond, Montserrat) · icons Lucide (ISC) · confetti canvas-confetti (ISC).
