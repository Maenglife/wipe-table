# Playable thin slice (2-player hotseat) — legacy

> **Legacy slice.** The current game is the solo building-and-expedition wipe in [`EXPEDITION.md`](EXPEDITION.md) and `web/expedition.html`. This sheet still describes the digital 2-player hotseat on the 10-card randomizer.

House rules for the digital Play mode. This is narrower than [`rules.md`](rules.md): no monument visits, no event prompts, and no card text beyond **set**, **cost**, and **types**.

## Setup

- Exactly **2 players**, local hotseat. Names optional.
- Tonight's wipe (usually 10 cards) comes from the randomizer.
- Starting kit each: **2 wood, 1 stone, 1 cloth**, a **raid token**, **0 scrap**, **0 damage**.

## Turn

Must gather, then may craft, then may raid, then end the turn.

1. **Gather** — pick 2 resources from wood / stone / cloth (duplicates allowed).
2. **Craft** (optional, once) — **unlock** a wipe card as a blueprint, **or** **craft it onto your base**.
3. **Raid** (optional) — spend your raid token on the other player.
4. **End turn** — pass the browser. The raid token returns at the start of your next turn.

## Costs

Pay `card.cost` from wood + stone + cloth. All three spend 1-for-1. The engine auto-picks the mix by draining the largest pile first (ties: wood, then stone, then cloth).

## Unlock vs craft

- **Unlock:** pay the cost, tuck the card onto your blueprint strip.
- **Craft onto base:** pay the cost again (or for the first time), put the card on your base.
- **Cheap Survival (cost ≤ 3):** you may craft onto your base **once** without unlocking. After that, unlock it before crafting it again.
- **Cost ≥ 4 Survival, and every Monument/Event:** unlock first, then craft.

Card-specific rules text is flavor in this slice. Raid power and walls only look at types.

## Raid

Spend the token. Attacker **power = 1 + number of Raid-type cards on their base**. Defender **defense = 1 + highest Build/Defend cost on their base**, or **1** if they have none.

- If **power ≥ defense:** steal **2 scrap** (if the defender has 0 scrap, the attacker still gains 2). Remove one **Build** from the defender if they have any (highest cost).
- Else the attacker takes **1 damage**.

## Downed

At **3 damage:** discard 2 resources (same auto-mix), set damage to 0, gain **1 wood**.

## Winning

- Immediate win at **12 scrap**.
- After **8 rounds** (both players have taken 8 turns), most scrap wins. **Buildings** (Build-type cards still on a base) break ties. Equal scrap and buildings is a draw.

## Browser

Mid-game state is saved in `localStorage` on this device. Refresh resumes. See the README for how to open Play.
