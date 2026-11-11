# Poster build tools

Not needed to run the site. These rebuilt the poster from the original invitation (`reference.png`).

| Script | What it does |
|---|---|
| `build-artwork.js [outDir]` | Removes the wording from `reference.png` (the current design, couple included) and cuts the layers that sit in front of the fireworks: `background.jpg`, `couple.webp`, `title.webp`, `wedding.webp` → `outDir` (default `./out`). Review them, then copy into `assets/`. The couple's outline comes from `couple-mask-source.png` (made with `remove-background.mjs`). |
| `build-layout.js [outDir] [step1Dir]` | Step 2: from step 1's `clean.png`, lifts out the old date box, "Wedding" + rings, guest card and heart ornament so the lower half can hold the GROOM/BRIDE panel and date band; writes the final `background.jpg` (convert it to `assets/art/poster.webp`, e.g. `sharp(...).webp({quality: 90})`) and the `wedding.webp`, `card.webp`, `ornament.webp` layers (placed and scaled in `index.html`). |
| `build-artwork-v1.js` | The same for the first design (`reference-v1.png`), where the couple was a separate, swappable photo. |
| `fit-text.js [iterations]` | Opens the running site, measures each line of wording, and nudges its `--x/--y/--fs/--sx` in `index.html` until it lands on the original's lettering. Only useful while the wording is the same as `reference.png`. |
| `remove-background.mjs` | Cuts a person/couple out of `photo.png` → `cut.png` (offline model, `npm i --no-save @imgly/background-removal-node@1.4.5`). |
| `tidy-cutout.js [fadeStart fadeEnd]` | Cleans that cutout (drops faint ghosts of people behind, makes clothing solid) and fades the bottom and cut-off sides → `couple-new.png`. |
| `screenshot.js out.png` | Screenshot of the poster alone (fireworks/confetti off) for side-by-side comparison. |

```bash
npm i --no-save sharp@0.34.4 playwright@1.57.0   # one-off
python3 -m http.server 8765 &                    # from the project root
node tools/poster-build/build-artwork.js
node tools/poster-build/fit-text.js 3
node tools/poster-build/screenshot.js /tmp/poster.png
```
Set `CHROME=/usr/bin/google-chrome` if Playwright's own browser isn't installed.
