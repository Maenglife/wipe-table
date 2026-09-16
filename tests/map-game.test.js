"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const game = require("../web/map-game.js");

function start(seed) {
  return game.createGame({ seed: seed || "test-wipe" });
}

function give(player, bag) {
  Object.keys(bag).forEach((r) => {
    player.carry[r] = (player.carry[r] || 0) + bag[r];
  });
}

function legalTypes(state) {
  return game.legalActions(state).map((a) => (a.recipe ? a.type + ":" + a.recipe : a.to ? a.type + ":" + a.to : a.cardId ? a.type + ":" + a.cardId : a.type));
}

describe("map graph", () => {
  it("has 12–16 connected nodes with beaches, clearings, resources, and monuments", () => {
    assert.ok(game.MAP_NODES.length >= 12 && game.MAP_NODES.length <= 16);
    const types = {};
    game.MAP_NODES.forEach((n) => {
      types[n.type] = (types[n.type] || 0) + 1;
      assert.ok(game.neighbors(n.id).length >= 1, n.id + " isolated");
    });
    assert.equal(types.beach, 2);
    assert.ok(types.clearing >= 2);
    assert.ok(types.resource >= 2);
    assert.ok(types.monument >= 3);
    const ids = game.MAP_NODES.map((n) => n.id);
    assert.ok(ids.includes("outpost"));
    assert.ok(ids.includes("airfield"));
    assert.ok(ids.includes("launch"));
  });

  it("starts both players on opposite beaches with 1 wood and WB0", () => {
    const state = start();
    assert.equal(state.players[0].node, "north-beach");
    assert.equal(state.players[1].node, "south-beach");
    assert.equal(state.players[0].carry.wood, 1);
    assert.equal(state.players[1].carry.wood, 1);
    assert.equal(state.players[0].workbench, 0);
    assert.equal(state.players[0].baseNode, null);
    assert.equal(state.actionsLeft, 2);
    assert.equal(state.currentPlayer, 0);
  });
});

describe("map movement", () => {
  it("moves along one road and spends one action", () => {
    const state = start();
    game.applyAction(state, { type: "move", to: "wood-grove" });
    assert.equal(state.players[0].node, "wood-grove");
    assert.equal(state.actionsLeft, 1);
    assert.equal(state.currentPlayer, 0);
  });

  it("rejects a node that is not adjacent", () => {
    const state = start();
    assert.throws(() => game.applyAction(state, { type: "move", to: "launch" }), /not connected/i);
    assert.equal(state.players[0].node, "north-beach");
    assert.equal(state.actionsLeft, 2);
  });

  it("allows two adjacent hops on the same turn", () => {
    const state = start();
    game.applyAction(state, { type: "move", to: "wood-grove" });
    game.applyAction(state, { type: "move", to: "outpost" });
    assert.equal(state.players[0].node, "outpost");
    assert.equal(state.currentPlayer, 1);
    assert.equal(state.actionsLeft, 2);
  });

  it("lists only neighboring roads as legal moves", () => {
    const state = start();
    const moves = game.legalActions(state).filter((a) => a.type === "move").map((a) => a.to).sort();
    assert.deepEqual(moves, ["scrap-heap", "wood-grove"].sort());
  });
});

describe("scavenge, deposit, and build", () => {
  it("scavenges up to 2 resources into carry", () => {
    const state = start();
    game.applyAction(state, { type: "move", to: "wood-grove" });
    game.applyAction(state, { type: "scavenge" });
    assert.equal(game.bagTotal(state.players[0].carry), 3);
    assert.equal(state.players[0].carry.wood, 2);
    assert.equal(state.players[0].carry.stone, 1);
    assert.ok(state.stocks["wood-grove"].wood <= 3);
  });

  it("respects the carry limit of 5", () => {
    const state = start();
    state.players[0].node = "wood-grove";
    state.players[0].carry = game.emptyBag();
    state.players[0].carry.wood = 4;
    game.applyAction(state, { type: "scavenge" });
    assert.equal(game.bagTotal(state.players[0].carry), 5);
  });

  it("builds a base on a clearing for 2 wood and 1 stone", () => {
    const state = start();
    const p = state.players[0];
    p.node = "west-clearing";
    p.carry = game.emptyBag();
    p.carry.wood = 2;
    p.carry.stone = 1;
    game.applyAction(state, { type: "build" });
    assert.equal(p.baseNode, "west-clearing");
    assert.equal(p.carry.wood, 0);
    assert.equal(p.carry.stone, 0);
  });

  it("deposits carry into base storage", () => {
    const state = start();
    const p = state.players[0];
    p.node = "west-clearing";
    p.baseNode = "west-clearing";
    p.carry.metal = 2;
    game.applyAction(state, { type: "deposit" });
    assert.equal(p.carry.metal, 0);
    assert.equal(p.storage.metal, 2);
  });

  it("cannot build twice or on a non-clearing", () => {
    const state = start();
    const p = state.players[0];
    p.node = "wood-grove";
    p.carry.wood = 2;
    p.carry.stone = 1;
    assert.throws(() => game.applyAction(state, { type: "build" }), /clearing/i);
    p.node = "west-clearing";
    game.applyAction(state, { type: "build" });
    p.carry.wood = 2;
    p.carry.stone = 1;
    state.actionsLeft = 2;
    assert.throws(() => game.applyAction(state, { type: "build" }), /already/i);
  });
});

describe("workbench gates", () => {
  it("blocks WB1 crafts until Outpost is visited", () => {
    const state = start();
    const p = state.players[0];
    p.node = "west-clearing";
    p.baseNode = "west-clearing";
    p.carry = game.emptyBag();
    p.carry.wood = 2;
    p.carry.cloth = 1;
    assert.equal(p.workbench, 0);
    assert.throws(() => game.applyAction(state, { type: "craft", recipe: "bow" }), /Workbench 1/);
    assert.ok(!legalTypes(state).includes("craft:bow"));
  });

  it("visiting Outpost, Airfield, and Launch Site raise WB to 1/2/3", () => {
    const state = start();
    const p = state.players[0];
    p.carry.food = 3;
    p.node = "outpost";
    game.applyAction(state, { type: "visit" });
    assert.equal(p.workbench, 1);
    p.node = "airfield";
    state.actionsLeft = 2;
    game.applyAction(state, { type: "visit" });
    assert.equal(p.workbench, 2);
    p.node = "launch";
    state.actionsLeft = 2;
    game.applyAction(state, { type: "visit" });
    assert.equal(p.workbench, 3);
    assert.ok(p.visited.outpost && p.visited.airfield && p.visited.launch);
  });

  it("crafts bow at WB1 and revolver only at WB2", () => {
    const state = start();
    const p = state.players[0];
    p.node = "west-clearing";
    p.baseNode = "west-clearing";
    p.workbench = 1;
    p.carry = game.emptyBag();
    p.carry.wood = 2;
    p.carry.cloth = 1;
    p.storage.metal = 2;
    p.storage.sulfur = 1;
    game.applyAction(state, { type: "craft", recipe: "bow" });
    assert.equal(p.gear.bow, true);
    state.currentPlayer = 0;
    state.actionsLeft = 2;
    state.phase = "playing";
    assert.throws(() => game.applyAction(state, { type: "craft", recipe: "revolver" }), /Workbench 2/);
    p.workbench = 2;
    game.applyAction(state, { type: "craft", recipe: "revolver" });
    assert.equal(p.gear.revolver, true);
    assert.equal(p.storage.metal, 0);
    assert.equal(p.storage.sulfur, 0);
  });

  it("pays craft costs from storage before carry", () => {
    const state = start();
    const p = state.players[0];
    p.node = "east-clearing";
    p.baseNode = "east-clearing";
    p.workbench = 1;
    p.carry = game.emptyBag();
    p.storage = game.emptyBag();
    p.storage.wood = 2;
    p.carry.wood = 2;
    game.applyAction(state, { type: "craft", recipe: "wooden-door" });
    assert.equal(p.doors.wooden, true);
    assert.equal(p.storage.wood, 0);
    assert.equal(p.carry.wood, 2);
  });
});

describe("combat math", () => {
  it("adds gear bonuses and injected dice, and the winner loots", () => {
    const state = start();
    const atk = state.players[0];
    const def = state.players[1];
    atk.gear.bow = true;
    atk.gear.revolver = true;
    atk.gear.armor = true;
    def.node = "outpost";
    atk.node = "mid-clearing";
    def.carry = game.emptyBag();
    def.carry.metal = 2;
    game.applyAction(state, { type: "move", to: "outpost", dice: { attack: 3, defense: 2 } });
    const combat = state.lastCombat;
    assert.ok(combat);
    // Attack: 1 + bow1 + revolver2 + armor1 + d6 3 = 8
    assert.equal(combat.attack.total, 8);
    assert.equal(combat.attack.die, 3);
    // Defense: 1 + d6 2 = 3 (no armor, not on their base)
    assert.equal(combat.defense.total, 3);
    assert.equal(combat.winner, 0);
    assert.equal(def.wounds, 1);
    assert.equal(def.carry.metal, 0);
    assert.equal(atk.carry.metal, 2);
  });

  it("grants a door bonus only when the fight is on the defender's base", () => {
    const onBase = start("door-on");
    const offBase = start("door-off");
    onBase.players[1].baseNode = "east-clearing";
    onBase.players[1].doors.wooden = true;
    onBase.players[1].node = "east-clearing";
    onBase.players[0].node = "train-yard";
    game.applyAction(onBase, { type: "move", to: "east-clearing", dice: { attack: 1, defense: 1 } });
    assert.equal(onBase.lastCombat.defense.door, true);
    assert.equal(onBase.lastCombat.defense.total, 1 + 1 + 1);

    offBase.players[1].baseNode = "east-clearing";
    offBase.players[1].doors.metal = true;
    offBase.players[1].node = "outpost";
    offBase.players[0].node = "mid-clearing";
    game.applyAction(offBase, { type: "move", to: "outpost", dice: { attack: 1, defense: 1 } });
    assert.equal(offBase.lastCombat.defense.door, false);
    assert.equal(offBase.lastCombat.defense.total, 1 + 1);
  });

  it("consumes a timed charge for +3 on the attack", () => {
    const state = start();
    state.players[0].gear.timedCharge = 1;
    state.players[1].node = "wood-grove";
    game.applyAction(state, { type: "move", to: "wood-grove", dice: { attack: 2, defense: 6 } });
    assert.equal(state.lastCombat.attack.chargeUsed, true);
    assert.equal(state.lastCombat.attack.total, 1 + 3 + 2);
    assert.equal(state.players[0].gear.timedCharge, 0);
  });

  it("drops carry and respawns after 3 wounds", () => {
    const state = start();
    const atk = state.players[0];
    const def = state.players[1];
    def.wounds = 2;
    def.node = "scrap-heap";
    def.carry = game.emptyBag();
    def.carry.cloth = 2;
    def.carry.sulfur = 1;
    atk.node = "outpost";
    game.applyAction(state, { type: "move", to: "scrap-heap", dice: { attack: 6, defense: 1 } });
    assert.equal(def.wounds, 0);
    assert.equal(def.deaths, 1);
    assert.equal(def.node, "south-beach");
    assert.equal(game.bagTotal(def.carry), 0);
    assert.ok(state.stocks["scrap-heap"].sulfur >= 1 || state.stocks["scrap-heap"].cloth >= 1);
  });

  it("awards a scrap token when the loser has no resources", () => {
    const state = start();
    state.players[1].node = "wood-grove";
    state.players[1].carry = game.emptyBag();
    state.players[1].storage = game.emptyBag();
    game.applyAction(state, { type: "move", to: "wood-grove", dice: { attack: 6, defense: 1 } });
    assert.equal(state.players[0].scrap, 1);
    assert.equal(state.lastCombat.loot.scrapToken, true);
  });

  it("ties inflict no wound and no loot", () => {
    const state = start();
    state.players[1].node = "wood-grove";
    const scrapBefore = state.players[0].scrap;
    game.applyAction(state, { type: "move", to: "wood-grove", dice: { attack: 4, defense: 4 } });
    assert.equal(state.lastCombat.winner, null);
    assert.equal(state.players[1].wounds, 0);
    assert.equal(state.players[0].scrap, scrapBefore);
  });
});

describe("cards", () => {
  it("draws at most once per turn into a hand of 3", () => {
    const state = start();
    game.applyAction(state, { type: "draw" });
    assert.equal(state.players[0].hand.length, 1);
    assert.equal(state.drewCardThisTurn, true);
    assert.throws(() => game.applyAction(state, { type: "draw" }), /already drew/i);
    game.applyAction(state, { type: "end" });
    game.applyAction(state, { type: "end" });
    state.players[0].hand = ["loot-wood", "loot-cloth", "loot-stone"];
    assert.throws(() => game.applyAction(state, { type: "draw" }), /hand is full/i);
  });

  it("plays a loot card as an action and grants resources", () => {
    const state = start();
    state.players[0].hand = ["loot-metal"];
    const before = state.players[0].carry.metal;
    game.applyAction(state, { type: "play", cardId: "loot-metal" });
    assert.equal(state.players[0].carry.metal, before + 2);
    assert.equal(state.players[0].hand.length, 0);
    assert.ok(state.discard.includes("loot-metal"));
  });

  it("blueprint cards discount the next craft by 1 resource", () => {
    const state = start();
    const p = state.players[0];
    p.node = "west-clearing";
    p.baseNode = "west-clearing";
    p.workbench = 1;
    p.hand = ["bp-notes"];
    p.carry = game.emptyBag();
    p.carry.wood = 1;
    game.applyAction(state, { type: "play", cardId: "bp-notes" });
    assert.equal(p.craftDiscount, 1);
    state.currentPlayer = 0;
    state.actionsLeft = 2;
    game.applyAction(state, { type: "craft", recipe: "wooden-door" });
    assert.equal(p.doors.wooden, true);
    assert.equal(p.carry.wood, 0);
    assert.equal(p.craftDiscount, 0);
  });

  it("event wound risk uses the injected die", () => {
    const state = start();
    state.players[0].hand = ["ev-patrol"];
    game.applyAction(state, { type: "play", cardId: "ev-patrol", dice: { event: 2 } });
    assert.equal(state.players[0].wounds, 1);
  });
});

describe("win check", () => {
  it("ends the game at 12 scrap", () => {
    const state = start();
    state.players[0].hand = ["loot-scrap"];
    state.players[0].scrap = 11;
    game.applyAction(state, { type: "play", cardId: "loot-scrap" });
    assert.equal(state.phase, "over");
    assert.equal(state.winner, 0);
    assert.match(state.winReason, /scrap/i);
  });

  it("after 10 rounds awards the player with more scrap", () => {
    const state = start();
    state.players[0].scrap = 4;
    state.players[1].scrap = 7;
    state.round = 10;
    state.currentPlayer = 1;
    game.applyAction(state, { type: "end" });
    assert.equal(state.round, 11);
    assert.equal(state.phase, "over");
    assert.equal(state.winner, 1);
    assert.match(state.winReason, /ten rounds/i);
  });

  it("eliminates a player after 3 downs if the other has a base", () => {
    const state = start();
    state.players[0].baseNode = "west-clearing";
    state.players[1].deaths = 2;
    state.players[1].wounds = 2;
    state.players[1].node = "wood-grove";
    game.applyAction(state, { type: "move", to: "wood-grove", dice: { attack: 6, defense: 1 } });
    assert.equal(state.players[1].deaths, 3);
    assert.equal(state.phase, "over");
    assert.equal(state.winner, 0);
  });
});
