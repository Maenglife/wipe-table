# Expedition — the wipe is the game

Product design for Wipe Table’s solo MVP. This is the current game. The 10-card tabletop randomizer and 2-player hotseat remain in the repo as a **legacy slice**.

This is an unofficial fan project. It is **not** affiliated with Facepunch.

## Why the pivot

The original companion dealt 10 Dominion-style kingdom cards (monuments, crafts, raid targets) and optionally played a thin hotseat with gather / craft / raid. That slice still works. It is no longer the product.

The new bet: **each wipe is a compact solo building-and-expedition game**. You wake on a quiet island, drop a 1×1, and decide how to grow based on *this* wipe’s geography, finds, and a single way off. There is no PvP and no combat in this version. The pressure is distance, carrying capacity, and when you choose to leave.

Target sitting: about 20–30 minutes, player-triggered ending.

## What varies each wipe

Three knobs, all of which change **how you build**, not only how the map looks.

1. **Island** — where wood, ore, and components sit, which ground is worth claiming, and where the two monuments stand.
2. **Discoveries** — a handful of blueprints. You start knowing almost nothing. Finds open a furnace, a recycling bench, an outpost claim, and similar.
3. **Opportunity** — one final project. In the MVP that project is a **broken extraction skiff** on Wreck Beach. Find the missing parts, prepare a fuel kit at home, assemble the boat, and choose when to leave.

The island resets next wipe. Memory of how you built stays (journal only). Persistent unlocks, if added later, should add *future variety*, not starting power.

## MVP scope

- One island, six named zones.
- **Three** authored resource layouts.
- **Two** monuments: Train Yard and Military Tunnels.
- A **handful** of useful blueprints (six in the pool, four present each wipe).
- **One** objective: repair and launch the skiff.
- Optional extra rooms: **1×1 → 1×2 → 2×2**. Extract does not wait on expand.
- No attacks, no scientists, no raid token.

Success criterion: play two seeds and point at a concrete difference — for example “last time I recycled beside Train Yard; this time I hauled ridge ore to a furnace at camp.”

## The three layouts

The zone graph is shared. Only nodes, monument seats, and the featured blueprint change.

| Id | Name | Geography | Featured find | Build response |
| --- | --- | --- | --- | --- |
| `harbor-scrap` | Harbor scrap | Components stacked on the Industrial Shelf beside Train Yard | Recycler | Compact recycling workshop; you may never need a 2×2 |
| `ridge-ore` | Inland ore | Rich ore on the ridge and far spine | Furnace | Furnace at camp; haul ore home from the ridge |
| `long-shore` | Long route | Both monuments on a long walk | Tool Cupboard | Small main base plus an expedition outpost and bag-recall |

Seeded generation always includes the featured blueprint, then three more from the remaining pool. Long-route wipes also keep at least one processor (furnace or recycler) so the skiff can be fueled without a soft lock.

## Blueprints

Always known: a bedroll comes with the 1×1. You may still craft a spare **Sleeping Bag** for an outpost.

Pool (four appear per wipe):

- **Furnace** — smelt ore into metal
- **Recycler** — turn components into scrap
- **Tool Cupboard** — claim a remote 1×1 outpost; fast-travel between claimed sites
- **Stone Hatchet** — extra wood and stone on gather
- **Workbench** — cheaper fuel kit
- **Garage Door** — extra carrying capacity (a storage room, not a raid wall)

Kits are crafted, then **installed** into an empty room at a claimed site.

## The skiff

Visible as a zone from the start. First visit to **Wreck Beach** identifies the boat and the parts list (this is a *proposed* extraction objective, not a copy of a video-game event).

| Part | Where |
| --- | --- |
| Pontoon plate | First search of Train Yard |
| Starter coil | First search of Military Tunnels |
| Fuel kit | Crafted at a claimed site from processed metal *or* scrap (or a slower raw recipe) |

Assemble on Wreck Beach, then **Extract** when you are ready. Ending is player-triggered; there is no hidden round cap.

## A day

Four actions. Then the next day starts.

- Move to an adjacent zone
- Recall to a claimed bed (1×1 at camp, or an outpost)
- Gather one resource node in the current zone
- Build (shack, expand, outpost)
- Craft / process
- Install a kit into a room
- Search a monument or the wreck
- Assemble the skiff
- Extract

Searching is scavenging, not a fight. The island is quiet this wipe.

## End screen

When you extract, the wipe records:

- A portrait of the base (rooms and stations)
- The expedition route (zones in visit order)
- Discoveries made
- Layout name and the hook that layout was asking for

That portrait is the memory. The next wipe is a new island roll.

## Legacy slices

- 10-card randomizer: `web/index.html`, `docs/rules.md`
- 2-player hotseat: `web/play.html`, `docs/PLAYABLE.md`

Those tools still sample `data/catalog.json`. Expedition reuses monument names and a few survival crafts from that catalog so the universe stays one island, but it does not use raid math or the 10-card kingdom row as its rules.
