"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const game = require("../web/game.js");

function card(id, extras) {
  return Object.assign(
    {
      id,
      name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      set: "Survival",
      cost: 2,
      types: ["Craft"],
    },
    extras || {}
  );
}

const wipe = [
  card("sleeping-bag", { cost: 2, types: ["Craft", "Build"] }),
  card("hunting-bow", { cost: 2, types: ["Craft"] }),
  card("wooden-door", { cost: 2, types: ["Build"] }),
  card("garage-door", { cost: 4, types: ["Build"] }),
  card("timed-charge", { cost: 5, types: ["Raid", "Craft"] }),
  card("auto-turret", { cost: 4, types: ["Defend", "Craft"] }),
  card("outpost", { set: "Monuments", cost: 3, types: ["Monument"] }),
  card("cargo-ship", { set: "Events", cost: 7, types: ["Event", "Raid"] }),
  card("campfire", { cost: 3, types: ["Craft"] }),
  card("workbench", { cost: 6, types: ["Craft"] }),
];

function start(names) {
  return game.createGame({ wipe, names: names || ["Ada", "Ben"], seed: "test-wipe" });
}

function apply(state, action) {
  return game.applyAction(state, action);
}

function skipRestOfTurn(state, after) {
  let next = state;
  if (after === "gather") next = apply(next, { type: "skipCraft" });
  if (after === "gather" || after === "craft") next = apply(next, { type: "skipRaid" });
  return apply(next, { type: "endTurn" });
}

function fullTurn(state, resources) {
  let next = apply(state, { type: "gather", resources: resources || ["wood", "wood"] });
  return skipRestOfTurn(next, "gather");
}

describe("createGame", () => {
  it("deals the starting kit to exactly two players", () => {
    const state = start();
    assert.equal(state.players.length, 2);
    assert.equal(state.phase, "gather");
    assert.equal(state.round, 1);
    assert.equal(state.currentPlayer, 0);
    for (const player of state.players) {
      assert.equal(player.wood, 2);
      assert.equal(player.stone, 1);
      assert.equal(player.cloth, 1);
      assert.equal(player.scrap, 0);
      assert.equal(player.damage, 0);
      assert.equal(player.raidToken, true);
      assert.deepEqual(player.blueprints, []);
      assert.deepEqual(player.base, []);
    }
    assert.equal(state.players[0].name, "Ada");
    assert.equal(state.wipe.length, 10);
  });

  it("fills blank names and rejects an empty wipe", () => {
    const state = game.createGame({ wipe, names: ["", ""] });
    assert.equal(state.players[0].name, "Player 1");
    assert.equal(state.players[1].name, "Player 2");
    assert.throws(() => game.createGame({ wipe: [] }), /wipe cards/);
  });
});

describe("gather", () => {
  it("takes exactly two resources and moves to craft", () => {
    const state = apply(start(), { type: "gather", resources: ["stone", "cloth"] });
    assert.equal(state.phase, "craft");
    assert.equal(state.players[0].stone, 2);
    assert.equal(state.players[0].cloth, 2);
    assert.equal(state.players[0].wood, 2);
  });

  it("rejects a bad gather", () => {
    assert.throws(() => apply(start(), { type: "gather", resources: ["wood"] }), /exactly 2/);
    assert.throws(() => apply(start(), { type: "gather", resources: ["sulfur", "wood"] }), /wood, stone, or cloth/);
    const after = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    assert.throws(() => apply(after, { type: "gather", resources: ["wood", "wood"] }), /already done/);
  });
});

describe("craft and unlock", () => {
  it("auto-picks the cheapest available resource mix", () => {
    assert.deepEqual(game.planSpend({ wood: 3, stone: 1, cloth: 1 }, 3), {
      wood: 3,
      stone: 0,
      cloth: 0,
    });
    assert.deepEqual(game.planSpend({ wood: 2, stone: 2, cloth: 0 }, 3), {
      wood: 2,
      stone: 1,
      cloth: 0,
    });
  });

  it("lets cheap Survival hit the base once without an unlock", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "craft", cardId: "sleeping-bag" });
    assert.deepEqual(state.players[0].base, ["sleeping-bag"]);
    assert.deepEqual(state.players[0].blueprints, []);
    assert.deepEqual(state.players[0].freeCraftUsed, ["sleeping-bag"]);
    assert.equal(state.phase, "raid");
    assert.equal(state.players[0].wood, 2);
  });

  it("requires an unlock to cheap-craft a second time", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "craft", cardId: "sleeping-bag" });
    state = skipRestOfTurn(state, "craft");
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    state = apply(state, { type: "skipRaid" });
    state = apply(state, { type: "endTurn" });
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    const blocked = game.inspectAction(state, { type: "craft", cardId: "sleeping-bag" });
    assert.equal(blocked.ok, false);
    assert.match(blocked.reason, /unlock/i);
    assert.throws(() => apply(state, { type: "craft", cardId: "sleeping-bag" }), /unlock/i);
  });

  it("blocks 4+ Survival and non-Survival until unlocked", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    assert.match(game.inspectAction(state, { type: "craft", cardId: "garage-door" }).reason, /Unlock/);
    assert.match(game.inspectAction(state, { type: "craft", cardId: "outpost" }).reason, /Unlock/);
    assert.throws(() => apply(state, { type: "craft", cardId: "garage-door" }), /Unlock/);
  });

  it("unlocks a card by paying its cost, then allows a later craft", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "unlock", cardId: "hunting-bow" });
    assert.deepEqual(state.players[0].blueprints, ["hunting-bow"]);
    assert.deepEqual(state.players[0].base, []);
    assert.equal(state.phase, "raid");
    state = skipRestOfTurn(state, "craft");
    state = fullTurn(state, ["wood", "wood"]);
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "craft", cardId: "hunting-bow" });
    assert.deepEqual(state.players[0].base, ["hunting-bow"]);
  });

  it("allows only one craft action per turn", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "unlock", cardId: "hunting-bow" });
    assert.equal(game.inspectAction(state, { type: "craft", cardId: "sleeping-bag" }).ok, false);
    assert.throws(() => apply(state, { type: "skipCraft" }), /craft step/);
  });

  it("skips craft into the raid step", () => {
    let state = apply(start(), { type: "gather", resources: ["cloth", "cloth"] });
    state = apply(state, { type: "skipCraft" });
    assert.equal(state.phase, "raid");
  });
});

describe("raid", () => {
  it("beats a naked base (1 vs 1), grants 2 scrap, and spends the token", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "stone"] });
    state = apply(state, { type: "skipCraft" });
    assert.equal(game.raidPower(state.wipe, state.players[0]), 1);
    assert.equal(game.defenseValue(state.wipe, state.players[1]), 1);
    state = apply(state, { type: "raid" });
    assert.equal(state.players[0].scrap, 2);
    assert.equal(state.players[1].scrap, 0);
    assert.equal(state.players[0].raidToken, false);
    assert.equal(state.phase, "end");
  });

  it("steals 2 scrap when the defender has enough", () => {
    let state = start();
    state.players[1].scrap = 5;
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    state = apply(state, { type: "raid" });
    assert.equal(state.players[0].scrap, 2);
    assert.equal(state.players[1].scrap, 3);
  });

  it("removes the highest Build on a successful raid", () => {
    let state = start();
    state.players[1].base = ["wooden-door", "garage-door"];
    state.players[0].base = ["timed-charge", "timed-charge", "timed-charge", "timed-charge"];
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    assert.equal(game.raidPower(state.wipe, state.players[0]), 5);
    assert.equal(game.defenseValue(state.wipe, state.players[1]), 5);
    state = apply(state, { type: "raid" });
    assert.deepEqual(state.players[1].base, ["wooden-door"]);
    assert.equal(state.players[0].damage, 0);
  });

  it("deals 1 damage when power is below defense", () => {
    let state = start();
    state.players[1].base = ["garage-door"];
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    assert.equal(game.defenseValue(state.wipe, state.players[1]), 5);
    state = apply(state, { type: "raid" });
    assert.equal(state.players[0].scrap, 0);
    assert.equal(state.players[0].damage, 1);
    assert.deepEqual(state.players[1].base, ["garage-door"]);
  });

  it("returns the raid token on the attacker's next turn", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    state = apply(state, { type: "raid" });
    assert.equal(state.players[0].raidToken, false);
    state = apply(state, { type: "endTurn" });
    state = fullTurn(state, ["wood", "wood"]);
    assert.equal(state.currentPlayer, 0);
    assert.equal(state.players[0].raidToken, true);
    assert.equal(game.inspectAction(state, { type: "raid" }).ok, false);
  });

  it("disables raid without a token", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    state.players[0].raidToken = false;
    const check = game.inspectAction(state, { type: "raid" });
    assert.equal(check.ok, false);
    assert.match(check.reason, /token/i);
  });
});

describe("downed", () => {
  it("discards 2 resources, clears damage, and grants 1 wood at 3 damage", () => {
    let state = start();
    state.players[0].damage = 2;
    state.players[0].wood = 3;
    state.players[0].stone = 1;
    state.players[0].cloth = 0;
    state.players[1].base = ["garage-door"];
    state = apply(state, { type: "gather", resources: ["cloth", "cloth"] });
    state = apply(state, { type: "skipCraft" });
    state = apply(state, { type: "raid" });
    assert.equal(state.players[0].damage, 0);
    assert.equal(state.players[0].wood, 2);
    assert.equal(state.players[0].stone, 1);
    assert.equal(state.players[0].cloth, 2);
  });
});

describe("winning", () => {
  it("ends the wipe when a player reaches 12 scrap", () => {
    let state = start();
    state.players[0].scrap = 10;
    state = apply(state, { type: "gather", resources: ["wood", "wood"] });
    state = apply(state, { type: "skipCraft" });
    state = apply(state, { type: "raid" });
    assert.equal(state.phase, "over");
    assert.equal(state.winner.playerIndex, 0);
    assert.match(state.winner.reason, /12 scrap/);
    assert.equal(game.inspectAction(state, { type: "endTurn" }).ok, false);
  });

  it("after 8 rounds, most scrap wins", () => {
    let state = start();
    state.players[0].scrap = 4;
    state.players[1].scrap = 1;
    for (let n = 0; n < 16; n++) state = fullTurn(state, ["wood", "stone"]);
    assert.equal(state.phase, "over");
    assert.equal(state.winner.playerIndex, 0);
    assert.match(state.winner.reason, /Most scrap/);
  });

  it("breaks an 8-round scrap tie with buildings", () => {
    let state = start();
    state.players[0].base = ["sleeping-bag"];
    for (let n = 0; n < 16; n++) state = fullTurn(state, ["wood", "stone"]);
    assert.equal(state.winner.playerIndex, 0);
    assert.match(state.winner.reason, /Buildings/);
  });

  it("draws when scrap and buildings stay tied after 8 rounds", () => {
    let state = start();
    for (let n = 0; n < 16; n++) state = fullTurn(state, ["wood", "stone"]);
    assert.equal(state.winner.draw, true);
    assert.match(state.winner.reason, /Draw/);
  });
});

describe("view, log, and resume", () => {
  it("exposes the board and disabled-action reasons", () => {
    const state = start();
    const view = game.getView(state);
    assert.equal(view.phaseLabel, "Gather");
    assert.equal(view.actions.skipCraft.ok, false);
    assert.match(view.actions.skipCraft.reason, /craft step/);
    assert.equal(view.actions.cards.length, 10);
    assert.equal(view.players[0].isCurrent, true);
    assert.ok(view.log.length);
  });

  it("round-trips mid-game state", () => {
    let state = apply(start(), { type: "gather", resources: ["wood", "cloth"] });
    state = apply(state, { type: "craft", cardId: "wooden-door" });
    const restored = game.parse(game.serialize(state));
    assert.equal(restored.phase, "raid");
    assert.deepEqual(restored.players[0].base, ["wooden-door"]);
    assert.equal(restored.seed, "test-wipe");
    const again = apply(restored, { type: "skipRaid" });
    assert.equal(again.phase, "end");
  });

  it("rejects a one-player save", () => {
    assert.throws(() => game.parse({ version: 1, wipe, players: [{}], phase: "gather" }), /exactly 2/);
  });
});
