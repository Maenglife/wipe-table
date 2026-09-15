"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const engine = require("../web/engine.js");

const catalogPath = path.join(__dirname, "../data/catalog.json");
const catalogData = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const cards = engine.loadCatalog(catalogData);
const pools = engine.groupBySet(cards);
const defaultMix = { Survival: 4, Monuments: 3, Events: 3 };

function rng(seed) {
  return engine.makeRng(seed).rng;
}

describe("catalog loading", () => {
  it("loads 24+ unique cards across three sets", () => {
    assert.ok(cards.length >= 24);
    assert.ok(cards.length <= 36);
    const ids = new Set(cards.map((c) => c.id));
    assert.equal(ids.size, cards.length);
    assert.deepEqual(
      [...new Set(cards.map((c) => c.set))].sort(),
      ["Events", "Monuments", "Survival"]
    );
  });

  it("gives every set a spread of cost bands", () => {
    for (const setName of engine.SET_NAMES) {
      const bands = new Set(pools[setName].map((c) => c.band));
      assert.ok(bands.has("2-3"), setName + " missing 2-3");
      assert.ok(bands.has("4"), setName + " missing 4");
      assert.ok(bands.has("5"), setName + " missing 5");
      assert.ok(pools[setName].some((c) => c.is_top), setName + " missing top");
    }
  });

  it("rejects duplicate ids and unknown sets", () => {
    assert.throws(
      () => engine.loadCatalog({ cards: [cards[0], { ...cards[0] }] }),
      /Duplicate/
    );
    assert.throws(
      () => engine.loadCatalog({ cards: [{ ...cards[0], set: "Base" }] }),
      /unknown set/i
    );
    assert.throws(() => engine.loadCatalog({ cards: [] }), /nonempty/);
  });

  it("requires rules text on every catalog card", () => {
    for (const card of catalogData.cards) {
      assert.ok(card.rules && card.rules.length > 20, card.id + " needs rules");
      assert.ok(Array.isArray(card.types) && card.types.length, card.id + " needs types");
    }
  });
});

describe("band assignment", () => {
  it("maps costs onto the house bands", () => {
    assert.equal(engine.assignBand(2), "2-3");
    assert.equal(engine.assignBand(3), "2-3");
    assert.equal(engine.assignBand(4), "4");
    assert.equal(engine.assignBand(5), "5");
    assert.equal(engine.assignBand(6), "top");
    assert.equal(engine.assignBand(8), "top");
  });

  it("recomputes band from cost even if JSON disagrees", () => {
    const loaded = engine.loadCatalog({
      cards: [{ ...catalogData.cards[0], cost: 7, band: "2-3" }],
    });
    assert.equal(loaded[0].band, "top");
    assert.equal(loaded[0].is_top, true);
  });
});

describe("validation", () => {
  it("accepts the default mix", () => {
    engine.validateSetCounts(defaultMix, pools, "balanced", false);
  });

  it("rejects totals other than 10 without opt-in", () => {
    assert.throws(
      () => engine.validateSetCounts({ Survival: 5, Monuments: 3, Events: 3 }, pools, "balanced", false),
      /exactly 10/
    );
  });

  it("allows custom size with explicit opt-in", () => {
    engine.validateSetCounts({ Survival: 6, Monuments: 2, Events: 0 }, pools, "random", true);
  });

  it("rejects balanced mixes under 6 cards", () => {
    assert.throws(
      () => engine.validateSetCounts({ Survival: 4 }, pools, "balanced", true),
      /at least 6/
    );
  });

  it("rejects asking for more cards than exist", () => {
    assert.throws(
      () => engine.validateSetCounts({ Survival: 99 }, pools, "random", true),
      /only \d+ cards exist/
    );
  });

  it("rejects an impossible balanced curve", () => {
    const template = catalogData.cards[0];
    const thin = engine.groupBySet(
      engine.loadCatalog({
        cards: [2, 2, 2, 2, 4, 4].map((cost, i) => ({
          ...template,
          id: "thin-" + i,
          name: "Thin " + i,
          set: "Survival",
          cost,
        })),
      })
    );
    assert.throws(
      () => engine.validateSetCounts({ Survival: 6 }, thin, "balanced", true),
      /balanced cost minimums/
    );
  });

  it("rejects unknown mode and unknown set", () => {
    assert.throws(() => engine.validateSetCounts(defaultMix, pools, "chaos", false), /Unknown mode/);
    assert.throws(() => engine.validateSetCounts({ Dominion: 10 }, pools, "random", false), /Unknown set/);
  });
});

describe("balanced sampling", () => {
  it("meets the house curve on the default mix", () => {
    for (let n = 0; n < 80; n++) {
      const result = engine.sampleWipe(cards, defaultMix, rng("curve-" + n), 500, "balanced", false);
      assert.equal(result.wipe.length, 10);
      assert.ok(engine.meetsBaseCurve(result.wipe));
      const ids = result.wipe.map((c) => c.id);
      assert.equal(new Set(ids).size, 10);
      const bySet = engine.SET_NAMES.map((name) => result.wipe.filter((c) => c.set === name).length);
      assert.deepEqual(bySet, [4, 3, 3]);
    }
  });

  it("succeeds on the survival-only mix", () => {
    const mix = { Survival: 10 };
    engine.validateSetCounts(mix, pools, "balanced", false);
    for (let n = 0; n < 40; n++) {
      const result = engine.sampleWipe(cards, mix, rng("solo-" + n), 500, "balanced", false);
      assert.equal(result.wipe.length, 10);
      assert.ok(result.wipe.every((c) => c.set === "Survival"));
      assert.ok(engine.meetsBaseCurve(result.wipe));
    }
  });

  it("pure random ignores the curve", () => {
    const result = engine.sampleWipe(cards, defaultMix, rng("rand-1"), 500, "random", false);
    assert.equal(result.wipe.length, 10);
    assert.equal(result.meta.mode, "random");
  });
});

describe("top-end repair", () => {
  const repairCatalog = engine.loadCatalog({
    cards: [
      { id: "a23", name: "Early A", set: "Survival", cost: 2, types: ["Craft"], rules: "Gather wood." },
      { id: "b23", name: "Early B", set: "Survival", cost: 3, types: ["Craft"], rules: "Gather stone." },
      { id: "c4", name: "Mid C", set: "Survival", cost: 4, types: ["Build"], rules: "Build metal." },
      { id: "d4", name: "Mid D", set: "Survival", cost: 4, types: ["Build"], rules: "Build turret." },
      { id: "e5", name: "Late E", set: "Survival", cost: 5, types: ["Raid"], rules: "Explosive charge." },
      { id: "f5", name: "Late F", set: "Survival", cost: 5, types: ["Raid"], rules: "Another charge." },
      { id: "g5", name: "Late G", set: "Survival", cost: 5, types: ["Build"], rules: "Armored door." },
      { id: "h5", name: "Late H", set: "Survival", cost: 5, types: ["Build"], rules: "Stone wall." },
      { id: "i6", name: "Heli Stand-in", set: "Survival", cost: 6, types: ["Event"], rules: "Wipe-end rotor." },
      { id: "j6", name: "Cargo Stand-in", set: "Survival", cost: 7, types: ["Event"], rules: "Wipe-end ship." },
    ],
  });

  it("flags three fives with no top card", () => {
    const wipe = repairCatalog.filter((c) => ["a23", "b23", "c4", "d4", "e5", "f5", "g5"].includes(c.id));
    assert.equal(engine.needsTopRepair(wipe), true);
    assert.equal(engine.needsTopRepair(wipe.concat(repairCatalog.find((c) => c.id === "i6")).slice(1)), false);
  });

  it("replaces one 5 with a top card from the same set", () => {
    const wipe = repairCatalog.filter((c) => ["a23", "b23", "c4", "d4", "e5", "f5", "g5"].includes(c.id));
    const repaired = engine.repairTopEnd(wipe, engine.groupBySet(repairCatalog), rng("repair"));
    assert.ok(repaired);
    assert.ok(repaired.some((c) => c.is_top));
    assert.equal(repaired.filter((c) => c.band === "5").length, 2);
    assert.ok(engine.meetsBaseCurve(repaired));
  });

  it("sampleWipe records repair metadata when the table would stall", () => {
    const mix = { Survival: 7 };
    let repaired = 0;
    for (let n = 0; n < 80; n++) {
      const result = engine.sampleWipe(repairCatalog, mix, rng("stall-" + n), 500, "balanced", true);
      assert.ok(engine.meetsBaseCurve(result.wipe));
      if (result.meta.repaired) {
        repaired++;
        assert.ok(result.wipe.some((c) => c.is_top));
        assert.ok(result.meta.repair_to);
      }
    }
    assert.ok(repaired > 0, "expected at least one top-end repair");
  });
});

describe("seeds", () => {
  it("replays the same wipe for the same seed and mix", () => {
    const a = engine.sampleWipe(cards, defaultMix, rng("harbor-17"), 500, "balanced", false);
    const b = engine.sampleWipe(cards, defaultMix, rng("harbor-17"), 500, "balanced", false);
    assert.deepEqual(
      a.wipe.map((c) => c.id),
      b.wipe.map((c) => c.id)
    );
    assert.equal(a.meta.repaired, b.meta.repaired);
  });

  it("changes the wipe when the seed changes", () => {
    const a = engine.sampleWipe(cards, defaultMix, rng("alpha"), 500, "balanced", false);
    const b = engine.sampleWipe(cards, defaultMix, rng("bravo"), 500, "balanced", false);
    assert.notDeepEqual(
      a.wipe.map((c) => c.id),
      b.wipe.map((c) => c.id)
    );
  });

  it("numeric and empty seeds produce a usable rng", () => {
    const numbered = engine.makeRng("42");
    assert.equal(numbered.seed, "42");
    const fresh = engine.makeRng("");
    assert.match(fresh.seed, /^\d+$/);
    const hashed = engine.makeRng("oil-rig");
    assert.equal(hashed.seed, "oil-rig");
  });
});

describe("text export", () => {
  it("includes names, seed, and mix", () => {
    const result = engine.sampleWipe(cards, defaultMix, rng("copy"), 500, "balanced", false);
    const text = engine.formatWipeText(result.wipe, defaultMix, result.meta, "copy");
    assert.match(text, /Wipe Table/);
    assert.match(text, /Seed: copy/);
    assert.match(text, /Survival 4 \/ Monuments 3 \/ Events 3/);
    assert.ok(text.includes(result.wipe[0].name));
  });
});
