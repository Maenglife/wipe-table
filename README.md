# Wipe Table

Unofficial tabletop companion that deals tonight’s **10 wipe cards** from three sets: **Survival**, **Monuments**, and **Events**. Same shape as a kingdom randomizer — JSON catalog, sampling engine, static web table — with original stencil art and a one-page rules sheet.

Not affiliated with Facepunch. Fan project for a hostile-island table game.

## Play the web table

```bash
python3 -m http.server 43123 --directory web
```

Then open http://127.0.0.1:43123

No package install is required for the UI. Choose your mix (default 4 / 3 / 3), Balanced costs or Pure random, and hit **New wipe**.

## CLI

```bash
node cli/wipe.js --seed 17
```

## Tests

```bash
node --test tests/*.test.js
```

## Refresh browser catalog

```bash
node tools/embed-catalog.js
```

## Rules

See [docs/rules.md](docs/rules.md): 2–4 players, ~45 minutes, gather → craft → optional raid.

## License note

Card names and setting draw on a well-known survival game’s vocabulary. Artwork is original SVG. This repo is not an official product.
