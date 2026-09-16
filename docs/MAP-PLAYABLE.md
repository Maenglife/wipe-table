# Wipe Table — island map (playable prototype)

Unofficial 2-player hotseat on a small hostile-island graph. Not affiliated with Facepunch. This is not the card-randomizer loop and not a Dominion kingdom table: cards here are loot, blueprint discounts, and light events.

Open `web/map.html` (from the table: **Play map**).

## What you need

- One browser, passed between two players
- No account, no server — state lives in `localStorage`

## The board

A fixed 14-node graph, not a hex simulation:

| Kind | Nodes |
| --- | --- |
| Beach spawns | North Beach (Ash), South Beach (Tide) |
| Resources | Wood Grove, Scrap Heap, Stone Quarry, Sulfur Pit |
| Clearings (bases) | West, East, Ridge |
| Monuments | Outpost (WB1), Airfield (WB2), Launch Site (WB3) |
| Secondary | Bandit Camp, Train Yard (scrap on first visit) |

Roads are the only movement. Tokens sit on nodes. Resource chips sit on nodes until scavenged.

## Setup

Both players start naked at Workbench 0 on opposite beaches with **1 wood** in carry and no base.

Ash takes the first turn.

## A turn — 2 actions

Move always costs 1 action. Other listed options also cost 1. You may end the turn early.

1. **Move** along one road to an adjacent node.
2. **Scavenge** if the node has chips: take up to 2 into personal carry (limit 5 total).
3. **Deposit** at your own base node: dump carry into cupboard storage.
4. **Build base** on a clearing you occupy, once per player: pay **2 wood + 1 stone** from carry or storage. Places your tool cupboard. You cannot plant on a clearing that already has a cupboard.
5. **Craft** only at your base, only if your workbench level is high enough.
6. **Visit monument** you occupy: pay **1 food or any 2 resources**. First visit unlocks that monument’s workbench if it is higher than yours, and Bandit Camp / Train Yard / Launch Site also pay scrap.
7. **Draw a card** once per turn, into a hand of at most 3.
8. **Play a card** from hand (also an action).

## Progression and recipes

Pay craft costs from **base storage first**, then carry.

| Bench | Unlock | Crafts |
| --- | --- | --- |
| WB0 | Beach | — |
| WB1 | Visit Outpost | Bow (2 wood + 1 cloth), Wooden Door (2 wood) |
| WB2 | Visit Airfield | Revolver (2 metal + 1 sulfur), Metal Door (2 metal) |
| WB3 | Visit Launch Site | Armor (2 metal + 1 cloth), Timed Charge (2 sulfur + 1 metal) |

Gear stays on the player. Doors stay on the base. Timed Charge is spent the next time you attack.

## Combat

If you **end a move** on a node the other player occupies, a fight starts.

- **Attack** = 1 + Bow +1 + Revolver +2 + Armor +1 + Timed Charge +3 (once, then gone) + d6
- **Defense** = 1 + Armor +1 + Wooden or Metal Door +1 **only if the fight is on the defender’s base node** + d6

Higher total wins. Ties are a clash: no loot, no wound.

Winner takes 2 resources from the loser (carry, then storage). If the loser has nothing, the winner gains **1 scrap token**. Loser takes 1 wound.

At 3 wounds: drop all carry on the node, respawn at your base if you built one, otherwise your beach, wounds clear. That is a down.

The UI shows both dice and the gear math.

## Cards (~16)

Loot grants resources. Blueprint tucks a −1 resource discount on your next craft. Events (Heli Light, Cargo Light, Patrol, Airdrop) may grant sulfur or scrap and then roll a wound risk (1–3 on a d6).

## Winning

The wipe ends when any of these is true:

- A player has **12 scrap** (from fights, monument rewards, scavenged scrap, and some cards), or
- **10 rounds** have passed — most scrap wins (standing base, then workbench, then Ash as table-side tie), or
- A player is downed **3 times** while the other still has a standing base.

## Table manners

This prototype is 2 players, local only. The randomizer on the home page is a separate mode. Do not treat this as an official product.
