"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const expedition = require("../web/expedition.js");

function apply(state, action) {
  return expedition.applyAction(state, action);
}

function seedFor(layoutId) {
  const seeds = expedition.demoSeeds();
  assert.ok(seeds[layoutId], "expected a demo seed for " + layoutId);
  return seeds[layoutId];
}

function runScript(state, actions) {
  let next = state;
  for (const action of actions) {
    const check = expedition.inspectAction(next, action);
    if (!check.ok) {
      throw new Error(
        "Illegal " +
          JSON.stringify(action) +
          " — " +
          check.reason +
          " at " +
          next.player.location +
          " inv=" +
          JSON.stringify(next.player.inventory)
      );
    }
    next = apply(next, action);
  }
  return next;
}

const SCRIPTS = {
  "harbor-scrap": [
    { type: "build", structure: "shack" },
    { type: "move", zoneId: "woods" },
    { type: "gather", resource: "wood" },
    { type: "move", zoneId: "industrial" },
    { type: "gather", resource: "components" },
    { type: "explore" },
    { type: "recall", zoneId: "camp" },
    { type: "craft", recipeId: "recycler" },
    { type: "install" },
    { type: "move", zoneId: "woods" },
    { type: "move", zoneId: "industrial" },
    { type: "gather", resource: "components" },
    { type: "recall", zoneId: "camp" },
    { type: "craft", recipeId: "recycle" },
    { type: "craft", recipeId: "fuel-kit" },
    { type: "move", zoneId: "woods" },
    { type: "move", zoneId: "ridge" },
    { type: "explore" },
    { type: "recall", zoneId: "camp" },
    { type: "move", zoneId: "wreck" },
    { type: "explore" },
    { type: "assemble" },
    { type: "extract" },
  ],
  "ridge-ore": [
    { type: "build", structure: "shack" },
    { type: "move", zoneId: "woods" },
    { type: "gather", resource: "wood" },
    { type: "explore" },
    { type: "gather", resource: "stone" },
    { type: "recall", zoneId: "camp" },
    { type: "craft", recipeId: "furnace" },
    { type: "install" },
    { type: "move", zoneId: "woods" },
    { type: "move", zoneId: "ridge" },
    { type: "gather", resource: "ore" },
    { type: "recall", zoneId: "camp" },
    { type: "craft", recipeId: "smelt" },
    { type: "craft", recipeId: "fuel-kit" },
    { type: "move", zoneId: "woods" },
    { type: "move", zoneId: "ridge" },
    { type: "move", zoneId: "far" },
    { type: "explore" },
    { type: "recall", zoneId: "camp" },
    { type: "move", zoneId: "wreck" },
    { type: "explore" },
    { type: "assemble" },
    { type: "extract" },
  ],
  "long-shore": [
    { type: "build", structure: "shack" },
    { type: "move", zoneId: "woods" },
    { type: "gather", resource: "wood" },
    { type: "move", zoneId: "industrial" },
    { type: "gather", resource: "components" },
    { type: "explore" },
    { type: "recall", zoneId: "camp" },
    { type: "move", zoneId: "woods" },
    { type: "gather", resource: "wood" },
    { type: "move", zoneId: "industrial" },
    { type: "gather", resource: "components" },
    { type: "recall", zoneId: "camp" },
    { type: "craft", recipeId: "fuel-kit" },
    { type: "craft", recipeId: "tool-cupboard" },
    { type: "install" },
    { type: "move", zoneId: "woods" },
    { type: "gather", resource: "wood" },
    { type: "move", zoneId: "ridge" },
    { type: "gather", resource: "stone" },
    { type: "move", zoneId: "far" },
    { type: "explore" },
    { type: "build", structure: "outpost" },
    { type: "recall", zoneId: "camp" },
    { type: "move", zoneId: "wreck" },
    { type: "explore" },
    { type: "assemble" },
    { type: "extract" },
  ],
};

describe("wipe generation", () => {
  it("replays the same island, monuments, and discovery queue for a seed", () => {
    const a = expedition.generateWipe("harbor-memory");
    const b = expedition.generateWipe("harbor-memory");
    assert.equal(a.layoutId, b.layoutId);
    assert.deepEqual(a.monuments, b.monuments);
    assert.deepEqual(a.discoveries, b.discoveries);
    assert.equal(a.objective.id, "extraction-skiff");
  });

  it("can roll all three layouts", () => {
    const seeds = expedition.demoSeeds();
    assert.deepEqual(Object.keys(seeds).sort(), ["harbor-scrap", "long-shore", "ridge-ore"]);
    for (const [layoutId, seed] of Object.entries(seeds)) {
      const wipe = expedition.generateWipe(seed);
      assert.equal(wipe.layoutId, layoutId);
      assert.equal(wipe.featured, expedition.layoutById(layoutId).featured);
      assert.ok(wipe.discoveries.includes(wipe.featured));
      assert.equal(wipe.discoveries.length, 4);
      assert.equal(new Set(wipe.discoveries).size, 4);
    }
  });

  it("puts components on the industrial shelf for harbor-scrap and features the recycler", () => {
    const wipe = expedition.generateWipe(seedFor("harbor-scrap"));
    assert.equal(wipe.layoutId, "harbor-scrap");
    assert.ok(wipe.zones.industrial.nodes.components >= 3);
    assert.equal(wipe.zones.industrial.monument, "train-yard");
    assert.equal(wipe.featured, "recycler");
    assert.ok(wipe.discoveries.includes("recycler"));
  });

  it("puts rich ore inland for ridge-ore and features the furnace", () => {
    const wipe = expedition.generateWipe(seedFor("ridge-ore"));
    assert.equal(wipe.layoutId, "ridge-ore");
    assert.ok(wipe.zones.ridge.nodes.ore >= 3);
    assert.equal(wipe.zones.far.monument, "military-tunnels");
    assert.equal(wipe.featured, "furnace");
    assert.doesNotMatch(wipe.hook, /expand|furnace line|furnace-line/i);
    assert.doesNotMatch(wipe.contrast, /expand|furnace line|furnace-line|furnace-heavy/i);
    assert.match(wipe.hook, /furnace/i);
    assert.match(wipe.hook, /ridge|inland|haul/i);
  });

  it("seats both monuments far apart on long-shore and keeps a processor", () => {
    const wipe = expedition.generateWipe(seedFor("long-shore"));
    assert.equal(wipe.layoutId, "long-shore");
    assert.equal(wipe.monuments["train-yard"], "industrial");
    assert.equal(wipe.monuments["military-tunnels"], "far");
    assert.equal(wipe.featured, "tool-cupboard");
    assert.ok(wipe.discoveries.includes("furnace") || wipe.discoveries.includes("recycler"));
  });

  it("changes discoveries when the seed changes inside the same layout", () => {
    const layoutId = "harbor-scrap";
    const first = seedFor(layoutId);
    let other = null;
    for (let i = 0; i < 4000; i++) {
      const seed = "alt-" + i;
      const wipe = expedition.generateWipe(seed);
      if (wipe.layoutId === layoutId && wipe.discoveries.join() !== expedition.generateWipe(first).discoveries.join()) {
        other = wipe;
        break;
      }
    }
    assert.ok(other, "expected a second scrap seed with a different blueprint bag");
  });
});

describe("core loop", () => {
  it("starts nearly naked on Shore Camp", () => {
    const state = expedition.createGame({ seed: seedFor("harbor-scrap") });
    assert.equal(state.player.location, "camp");
    assert.equal(state.player.inventory.wood, 2);
    assert.equal(state.player.inventory.stone, 1);
    assert.equal(state.player.inventory.cloth, 1);
    assert.equal(state.base.camp.shape, "none");
    assert.equal(state.phase, undefined);
    assert.equal(state.ended, null);
    assert.deepEqual(state.player.known, ["sleeping-bag"]);
  });

  it("builds 1×1 → 1×2 → 2×2 and refuses to skip steps", () => {
    let state = expedition.createGame({ seed: seedFor("ridge-ore") });
    assert.match(expedition.inspectAction(state, { type: "build", structure: "expand-1x2" }).reason, /1×1/);
    state = apply(state, { type: "build", structure: "shack" });
    assert.equal(state.base.camp.shape, "1x1");
    assert.equal(state.base.camp.rooms.length, 1);
    state.player.inventory.wood = 6;
    state.player.inventory.stone = 4;
    state = apply(state, { type: "build", structure: "expand-1x2" });
    assert.equal(state.base.camp.shape, "1x2");
    state = apply(state, { type: "build", structure: "expand-2x2" });
    assert.equal(state.base.camp.shape, "2x2");
    assert.equal(state.base.camp.rooms.length, 4);
  });

  it("rejects combat-shaped actions", () => {
    const state = expedition.createGame({ seed: "quiet" });
    assert.match(expedition.inspectAction(state, { type: "raid" }).reason, /Unknown action/);
    assert.match(expedition.inspectAction(state, { type: "attack" }).reason, /Unknown action/);
  });

  it("cannot extract before the skiff is assembled on Wreck Beach", () => {
    let state = expedition.createGame({ seed: seedFor("harbor-scrap") });
    assert.match(expedition.inspectAction(state, { type: "extract" }).reason, /Wreck Beach/);
    state.player.location = "wreck";
    assert.match(expedition.inspectAction(state, { type: "extract" }).reason, /Assemble/);
    state.boat.seen = true;
    state.boat.parts = { pontoon: true, coil: true, fuel: true };
    assert.match(expedition.inspectAction(state, { type: "assemble" }).reason, /^$/);
    state = apply(state, { type: "assemble" });
    state = apply(state, { type: "extract" });
    assert.ok(state.ended);
    assert.equal(state.ended.layoutId, "harbor-scrap");
    assert.match(state.ended.portrait, /\[ empty beach \]|----/);
    assert.ok(state.ended.route.includes("Wreck Beach") || state.ended.route.includes("Shore Camp"));
    assert.match(state.ended.ending, /leave|Extracted/i);
  });

  it("short-circuits to a summary with route, discoveries, and a base portrait", () => {
    let state = expedition.createGame({ seed: seedFor("ridge-ore") });
    state = apply(state, { type: "build", structure: "shack" });
    state.player.known.push("furnace");
    state.player.revealed.push("furnace");
    state.player.inventory = {
      wood: 6,
      stone: 6,
      cloth: 0,
      ore: 0,
      components: 0,
      metal: 0,
      scrap: 0,
    };
    state = apply(state, { type: "craft", recipeId: "furnace" });
    state = apply(state, { type: "install", kitId: "furnace", roomIndex: 0 });
    state.boat = { seen: true, parts: { pontoon: true, coil: true, fuel: true }, assembled: true };
    state.player.location = "wreck";
    state.route.push("woods", "ridge", "far", "wreck");
    state = apply(state, { type: "extract" });
    assert.match(state.ended.portrait, /F/);
    assert.ok(state.ended.discoveries.includes("Furnace"));
    assert.ok(state.ended.route.includes("Inland Ridge"));
    assert.match(state.ended.contrast, /furnace/i);
  });
});

describe("end to end extraction", () => {
  it("completes harbor-scrap as a compact recycler workshop", () => {
    const state = runScript(expedition.createGame({ seed: seedFor("harbor-scrap") }), SCRIPTS["harbor-scrap"]);
    assert.ok(state.ended);
    assert.equal(state.ended.layoutId, "harbor-scrap");
    assert.equal(state.base.camp.shape, "1x1");
    assert.equal(state.base.camp.rooms[0].station, "recycler");
    assert.deepEqual(Object.keys(state.base.outposts), []);
    assert.ok(state.ended.discoveries.includes("Recycler"));
    assert.match(state.ended.contrast, /recycling workshop/i);
  });

  it("completes ridge-ore on a 1×1 furnace at camp", () => {
    const state = runScript(expedition.createGame({ seed: seedFor("ridge-ore") }), SCRIPTS["ridge-ore"]);
    assert.ok(state.ended);
    assert.equal(state.ended.layoutId, "ridge-ore");
    assert.equal(state.base.camp.shape, "1x1");
    assert.equal(state.base.camp.rooms.length, 1);
    assert.equal(state.base.camp.rooms[0].station, "furnace");
    assert.ok(state.ended.route.includes("Inland Ridge"));
    assert.match(state.ended.contrast, /furnace/i);
    assert.match(state.ended.contrast, /ridge/i);
    assert.doesNotMatch(state.ended.contrast, /expand|furnace line|furnace-heavy/i);
  });

  it("completes long-shore with a small home and a far outpost", () => {
    const state = runScript(expedition.createGame({ seed: seedFor("long-shore") }), SCRIPTS["long-shore"]);
    assert.ok(state.ended);
    assert.equal(state.ended.layoutId, "long-shore");
    assert.equal(state.base.camp.shape, "1x1");
    assert.ok(state.base.outposts.far);
    assert.equal(state.base.camp.rooms[0].station, "cupboard");
    assert.match(state.ended.contrast, /outpost/i);
  });

  it("two demo seeds push different build incentives", () => {
    const scrap = expedition.generateWipe(seedFor("harbor-scrap"));
    const ore = expedition.generateWipe(seedFor("ridge-ore"));
    assert.notEqual(scrap.layoutId, ore.layoutId);
    assert.notEqual(scrap.featured, ore.featured);
    assert.ok(scrap.zones.industrial.nodes.components > (ore.zones.industrial.nodes.components || 0));
    assert.ok((ore.zones.ridge.nodes.ore || 0) > (scrap.zones.ridge.nodes.ore || 0));
  });
});

describe("skiff honesty", () => {
  function identifyAtWreck(state) {
    state.player.location = "wreck";
    return apply(state, { type: "explore" });
  }

  function identifiedLine(state) {
    const line = state.log.filter((entry) => /Identified/i.test(entry)).pop();
    assert.ok(line, "expected an identify log line");
    return line;
  }

  it("identify after owning pontoon never says Missing for held parts", () => {
    let state = expedition.createGame({ seed: seedFor("ridge-ore") });
    state.boat.parts.pontoon = true;
    state = identifyAtWreck(state);
    const line = identifiedLine(state);
    const missing = expedition.missingSkiffParts(state.boat);
    assert.deepEqual(
      missing.map((part) => part.id),
      ["coil", "fuel"]
    );
    assert.match(line, /Missing:/);
    assert.doesNotMatch(line, /pontoon/i);
    assert.match(line, /starter coil/i);
    assert.match(line, /fuel kit/i);
    const reinspect = expedition.inspectAction(state, { type: "explore" });
    const assemble = expedition.inspectAction(state, { type: "assemble" });
    assert.equal(reinspect.ok, false);
    assert.equal(assemble.ok, false);
    assert.equal(reinspect.reason, expedition.skiffStatusCopy(state.boat));
    assert.equal(assemble.reason, expedition.skiffAssembleReason(state.boat));
    assert.doesNotMatch(reinspect.reason, /pontoon/i);
    assert.doesNotMatch(assemble.reason, /pontoon/i);
    assert.match(reinspect.reason, /starter coil/i);
    assert.match(assemble.reason, /starter coil/i);
    assert.match(reinspect.reason, /fuel kit/i);
    assert.match(assemble.reason, /fuel kit/i);
    assert.equal(line, expedition.skiffIdentifyCopy({ parts: { pontoon: true, coil: false, fuel: false } }));
  });

  it("omits fuel from Missing when the kit was crafted before identify", () => {
    let state = expedition.createGame({ seed: seedFor("ridge-ore") });
    state.boat.parts.fuel = true;
    state = identifyAtWreck(state);
    const line = identifiedLine(state);
    assert.match(line, /Missing:/);
    assert.doesNotMatch(line, /fuel/i);
    assert.match(line, /pontoon plate/i);
    assert.match(line, /starter coil/i);
    const status = expedition.getView(state).boat.status;
    assert.doesNotMatch(status, /fuel/i);
    assert.match(status, /pontoon plate/i);
  });

  it("says parts are on you when every skiff part is already held", () => {
    let state = expedition.createGame({ seed: seedFor("ridge-ore") });
    state.boat.parts = { pontoon: true, coil: true, fuel: true };
    state = identifyAtWreck(state);
    const line = identifiedLine(state);
    assert.doesNotMatch(line, /Missing/i);
    assert.match(line, /parts on you/i);
    assert.match(line, /assemble when ready/i);
    const reinspect = expedition.inspectAction(state, { type: "explore" });
    assert.equal(reinspect.reason, expedition.skiffStatusCopy(state.boat));
    assert.match(reinspect.reason, /parts on you/i);
    assert.doesNotMatch(reinspect.reason, /Missing/i);
    const assemble = expedition.inspectAction(state, { type: "assemble" });
    assert.equal(assemble.ok, true);
    assert.equal(assemble.reason, "");
  });
});

describe("ui honesty", () => {
  it("pack-full gather never mentions Store", () => {
    const state = expedition.createGame({ seed: seedFor("ridge-ore") });
    const cap = expedition.carryCap(state);
    state.player.inventory = {
      wood: cap,
      stone: 0,
      cloth: 0,
      ore: 0,
      components: 0,
      metal: 0,
      scrap: 0,
    };
    const check = expedition.inspectAction(state, { type: "gather", resource: "wood" });
    assert.equal(check.ok, false);
    assert.match(check.reason, /Pack is full/i);
    assert.doesNotMatch(check.reason, /store/i);
    assert.match(check.reason, /spend/i);
    assert.match(check.reason, /end day/i);
    assert.match(check.reason, /recall/i);
  });

  it("hides expand until a 1×1 exists and primaries Extract only after skiff progress", () => {
    let state = expedition.createGame({ seed: seedFor("ridge-ore") });
    let view = expedition.getView(state);
    assert.equal(view.showExpand["expand-1x2"], false);
    assert.equal(view.showExpand["expand-2x2"], false);
    assert.equal(view.extractPrimary, false);

    state = apply(state, { type: "build", structure: "shack" });
    view = expedition.getView(state);
    assert.equal(view.base.camp.shape, "1x1");
    assert.equal(view.showExpand["expand-1x2"], true);
    assert.equal(view.showExpand["expand-2x2"], false);
    assert.equal(view.extractPrimary, false);

    state.player.inventory.wood = 6;
    state.player.inventory.stone = 4;
    state = apply(state, { type: "build", structure: "expand-1x2" });
    view = expedition.getView(state);
    assert.equal(view.base.camp.shape, "1x2");
    assert.equal(view.showExpand["expand-1x2"], false);
    assert.equal(view.showExpand["expand-2x2"], true);

    state.boat.parts.pontoon = true;
    assert.equal(expedition.getView(state).extractPrimary, true);
    state.boat.parts.pontoon = false;
    state.boat.seen = true;
    assert.equal(expedition.getView(state).extractPrimary, true);
  });

  it("nextHint tells a cold start to drop a 1×1 and never says Store", () => {
    const state = expedition.createGame({ seed: seedFor("ridge-ore") });
    const view = expedition.getView(state);
    assert.match(view.nextHint, /1×1/);
    assert.match(view.nextHint, /gather/i);
    assert.doesNotMatch(view.nextHint, /store/i);
    const after = expedition.getView(apply(state, { type: "build", structure: "shack" }));
    assert.match(after.nextHint, /Train Yard|Wreck Beach|Search/i);
    assert.doesNotMatch(after.nextHint, /store/i);
  });
});

describe("resume", () => {
  it("round-trips a mid-wipe state", () => {
    let state = expedition.createGame({ seed: seedFor("harbor-scrap") });
    state = apply(state, { type: "build", structure: "shack" });
    state = apply(state, { type: "move", zoneId: "woods" });
    const restored = expedition.parse(expedition.serialize(state));
    assert.equal(restored.player.location, "woods");
    assert.equal(restored.base.camp.shape, "1x1");
    const again = apply(restored, { type: "gather", resource: "wood" });
    assert.ok(again.player.inventory.wood >= 3);
  });
});
