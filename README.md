# Aaron & Josephine — Interactive Wedding Invitation

Static site (HTML + Tailwind + vanilla JS). No backend, no build needed to run.

The page is the printed invitation brought to life: one poster on the invitation's own 1065 × 1477 grid. On phones and tablets held upright the whole invitation fits the screen edge to edge with no scrolling; on large screens it is shown framed at full size. Live fireworks burst in the sky behind the couple and confetti falls on top.

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
| Date | `date` | `'Friday,\n1st January\n2027'` (`\n` = line break) |
| Time | `time` | `'From 2:00 PM\nonwards'` |
| Venue | `venue` | `'Kagga\nGardens'` |
| Location (under the venue) | `location` | `''` = none |
| Map | `mapsQuery` / `mapsUrl` | tapping the venue opens a map window; `mapsQuery` is what the map shows and gives directions to (e.g. `'Kaga Gardens, Najjera, Kampala'`); `mapsUrl` (optional) is used for the "Open in Google Maps" button |
| Couple names | `couple.groom`, `couple.bride`, `couple.short` | `'Aaron'`, `'Josephine'`, `'Aaron & Josephine'` |
| Intro lines | `intro` | `'Come let’s dance\ninto the new year\nwith our beloved'` |
| Gold ribbon under the intro | `honorific` | `'OMUBAKA WA KABAKA E BUNGELEZA'` (`''` hides it) |
| Line under the names | `inviteLine` | `'together with their families, cordially invite you to their'` |
| Guest card | `guestCard.heading`, `guestCard.sub` | `'YOUR PRESENCE WILL …'`, `'Kindly be our guest'` |
| Bottom line | `tagline` | `'Let’s celebrate love, family and new beginnings together!'` |
| Guest line label | `guest.label` | `'Names:'` |
| GROOM / BRIDE panel | `families.groom`, `families.bride` | `{ label: 'GROOM', lines: 'Son of\nMr. … and\nMrs. …\nof …' }` |
| Default guest name | `guest.defaultName` | `''` = blank dotted line |
| Fireworks gap | `fireworks.minDelayMs` / `maxDelayMs` | `650` / `1700` |
| Fireworks density | `fireworks.maxParticles` | `{ mobile: 380, desktop: 900 }` |
| Confetti frequency | `confetti.intervalMs` | `5000` |
| Confetti amount | `confetti.particleCount` | `{ mobile: 45, desktop: 90 }` |
| Fireworks video | `fireworks.video` | `'assets/backgrounds/fireworks.mp4'` (optional) |

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
| `assets/backgrounds/poster-background.jpg` | The invitation design (couple included) with all wording removed |
| `assets/couple/couple-layer.webp` | The couple cut from the design, layered in front of the fireworks so bursts go behind them |
| `assets/art/title.webp`, `wedding.webp` | Gold lettering and rings, layered in front of the fireworks ("Wedding" is shown smaller, above the GROOM/BRIDE panel) |
| `assets/art/card.webp`, `ornament.webp` | The guest card and the heart ornament, moved down to make room for the panel and the date band |
| `assets/couple/couple-photo-original.jpg`, `couple-cutout.png` | The couple's "London save the date" photo and a cutout of it |
| `assets/couple/mark-and-mary-*` | Earlier placeholder couple (only used by `build-artwork-v1.js`) |
| `assets/og-image.jpg` | WhatsApp link preview (1200×630) |
| `favicon.ico`, `assets/icons/favicon.svg`, `favicon-32.png` | Browser-tab icon: two gold rings on navy (the SVG is the source; the others are made from it) |
| `assets/icons/apple-touch-icon.png` | Icon when the page is saved to an iPhone/iPad home screen |

The couple is part of the poster artwork (`tools/poster-build/reference.png`). To change the artwork, put the new design in `reference.png` and rebuild the layers with `tools/poster-build/build-artwork.js` then `build-layout.js` (see its README). Then refresh `assets/og-image.jpg`.

**Moving text on the poster:** each line in `index.html` has `style="--x:…;--y:…;--fs:…;--sx:…"`: position (poster pixels; for centred lines `--x` is the centre), font size, and horizontal squeeze. `tools/poster-build/` has the scripts that rebuilt the artwork and measured the text against the original (see its README).

**WhatsApp preview:** WhatsApp needs an absolute image URL. After deploying, change `<meta property="og:image">` in `index.html` to `https://your-site/assets/og-image.jpg`.

## Controls

No buttons over the invitation: fireworks and confetti play automatically (turn them off for everyone with `fireworks.enabled` / `confetti.enabled` in the config). Tap the sky on the poster to launch a firework; tap the venue to see the map (with directions) in a window over the invitation.
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
