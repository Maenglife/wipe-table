# Wipe Table

```bash
python3 -m http.server 43123 --directory web
```

Windows (either works):

```bash
python -m http.server 43123 --directory web
py -m http.server 43123 --directory web
```

Open http://127.0.0.1:43123/ and **Play the expedition**. Unofficial fan project — not Facepunch.

## What a wipe is

About 20–30 minutes. **No attacks and no PvP.** You start with almost nothing on Shore Camp.

1. Drop a **1×1**. Extra rooms (1×2 / 2×2) are optional comfort — extract never waits on a bigger shack.
2. Gather the nodes this layout actually placed.
3. Search Train Yard and Military Tunnels for blueprints and boat parts (scavenging, not combat).
4. Craft and install what you discovered — furnace, recycler, cupboard, hatchet, workbench, storage.
5. Identify the broken extraction skiff on Wreck Beach, assemble it when the pontoon, coil, and fuel kit are in, and **choose** when to extract.

The end screen keeps a portrait of the base, the route you walked, and the discoveries you made. The island resets; memory stays on this device. Persistent unlocks, if they land later, should add future variety rather than starting power.

Design note: [`docs/EXPEDITION.md`](docs/EXPEDITION.md).

## Legacy slices

The original product was a Dominion-style **10-card tabletop companion** plus a thin 2-player hotseat. Those still ship:

- Randomizer: home page, folded **Legacy tabletop companion** (`web/index.html`)
- Hotseat: `web/play.html` after **Hotseat this wipe**
- Tabletop sheet: [`docs/rules.md`](docs/rules.md)
- Hotseat house rules: [`docs/PLAYABLE.md`](docs/PLAYABLE.md)

They are marked as prior/legacy. Expedition does not use raid math.

## Catalog and engines

- Canonical card catalog: `data/catalog.json` (legacy randomizer)
- Sampling engine (no DOM): `web/engine.js`
- Expedition engine (no DOM): `web/expedition.js`
- Browser embed of the catalog: `web/catalog.embed.js`

After editing the JSON:

```bash
node tools/embed-catalog.js
node tools/embed-catalog.js --check
```

## CLI

Node 18+:

```bash
node cli/expedition.js
node cli/expedition.js --seed wipe-1
node cli/expedition.js --seed wipe-4 --json

node cli/wipe.js
node cli/wipe.js --set survival=4 --set monuments=3 --set events=3 --mode balanced --seed 17
```

## Tests

```bash
node --test tests/*.test.js
```

Covers catalog sampling, the legacy hotseat (`web/game.js`), seeded expedition generation, build progression, and extraction end conditions (`web/expedition.js`).

## IP

Wipe Table is an unofficial fan project and is not affiliated with Facepunch. It uses recognizable survival-island language because that is the point of staying in the universe. Rules text, stencil card art, and the expedition portrait are original. Do not treat this as an official product.
