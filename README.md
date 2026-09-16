# Wipe Table

Unofficial tabletop companion for a small survival-island board-game spin-off. It picks tonight's **10 wipe cards** from three owned sets, with an optional balanced cost curve, and shows them on a web table.

This is a fan project. It is **not** affiliated with Facepunch.

## Island map (2-player prototype)

A separate mode from the randomizer: Ash and Tide share a small road graph, scavenge chips, plant a cupboard, visit monuments for Workbench 1/2/3, and fight if they land on the same node.

Rules: [`docs/MAP-PLAYABLE.md`](docs/MAP-PLAYABLE.md).

```bash
python3 -m http.server 43123 --directory web
```

Windows:

```bash
python -m http.server 43123 --directory web
```

Then open `http://127.0.0.1:43123/` for the wipe builder, or `http://127.0.0.1:43123/map.html` for **Play map**. You can also open the HTML files directly. Pass one browser between two players. Progress saves in this browser.

## Game mapping

Dominion's 10 kingdom piles become this wipe's 10 cards: monuments, crafts, and raid targets in play tonight.

| Band | Cost | On the island |
| --- | --- | --- |
| Early | 2–3 | Wood / stone — sleeping bag, bow, wooden door |
| Mid | 4 | Metal — garage door, turret, recycler |
| Late | 5 | Sulfur / HQM — timed charge, armored door |
| Top | 6+ | Wipe-end events — Bradley, cargo, oil, heli |

Sets:

1. **Survival** (base) — gather, craft, build, defend
2. **Monuments** — airfield, launch site, military tunnels, outpost, bandit camp, and similar
3. **Events** — heli, cargo, oil, Bradley, airdrop

How those 10 cards actually play is in [`docs/rules.md`](docs/rules.md): 2–4 players, about 45 minutes, one wipe.

## Open the web UI

No package install is required for the table.

```bash
python3 -m http.server 43123 --directory web
```

Then open `http://127.0.0.1:43123/`. You can also open `web/index.html` directly in a browser. **Play map** on that page opens the 2-player island.

**New wipe** draws a fresh seed. Under Advanced, paste a seed and use **Use seed** to replay. Default mix is Survival 4 / Monuments 3 / Events 3. **Survival only** is a 10-card base-set preset.

## Catalog and engine

- Canonical catalog: `data/catalog.json` (34 original cards)
- Sampling engine (no DOM): `web/engine.js`
- Browser embed of the catalog: `web/catalog.embed.js`

After editing the JSON:

```bash
node tools/embed-catalog.js
node tools/embed-catalog.js --check
```

Balanced mode (house preference, not an official rule):

- at least 2 cards in the 2–3 band
- at least 2 costing 4
- at least 2 costing 5
- if 3+ cards are exact-5 and none are top (6+/event), replace one 5 with a random eligible top card from the same set if possible

Counts are validated before RNG. Totals other than 10 need the custom-size checkbox. Balanced needs at least 6 cards.

## CLI

Node 18+:

```bash
node cli/wipe.js
node cli/wipe.js --set survival=4 --set monuments=3 --set events=3 --mode balanced --seed 17
node cli/wipe.js --mode random --json
```

## Tests

```bash
node --test tests/*.test.js
```

Covers catalog loading, band assignment, validation, balanced sampling, top-end repair, seeds, map movement, combat math, workbench gates, and win checks.

## IP

Wipe Table is an unofficial fan project and is not affiliated with Facepunch. Cards use recognizable survival-island language because that is the point of staying in the universe. Rules text and stencil card art are original. Do not treat this as an official product.
