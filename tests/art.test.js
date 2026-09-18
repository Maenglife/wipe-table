"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const expedition = require("../web/expedition.js");

const artDir = path.join(__dirname, "../web/art");
const uiSrc = fs.readFileSync(path.join(__dirname, "../web/expedition-ui.js"), "utf8");
const htmlSrc = fs.readFileSync(path.join(__dirname, "../web/expedition.html"), "utf8");
const cssSrc = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8");
const iconSrc = fs.readFileSync(path.join(__dirname, "../web/icons.js"), "utf8");

const STILLS = [
  "island-twin-lobes.png",
  "lattice-spike.png",
  "toe-crane.png",
  "base-growth-bible.png",
  "hero-establishing-a.png",
];

const ZONE_IDS = ["camp", "wreck", "woods", "industrial", "ridge", "far"];

describe("art glyphs", () => {
  it("ships the five named stills", () => {
    STILLS.forEach((name) => {
      const file = path.join(artDir, name);
      assert.ok(fs.existsSync(file), name);
      assert.ok(fs.statSync(file).size > 10000, name + " should be a real still");
    });
  });

  it("wires Twin Lobes chrome and monument glyphs without new zone ids", () => {
    assert.match(uiSrc, /art\/island-twin-lobes\.png/);
    assert.match(uiSrc, /ex-map-chrome/);
    assert.match(uiSrc, /"train-yard": \{ src: "art\/toe-crane\.png"/);
    assert.match(uiSrc, /"military-tunnels": \{ src: "art\/lattice-spike\.png"/);
    assert.match(cssSrc, /\.ex-map-chrome/);
    assert.match(cssSrc, /\.ex-zone/);
    assert.match(cssSrc, /\.ex-sea/);
    assert.match(cssSrc, /object-fit:\s*contain/);
    assert.match(cssSrc, /\.ex-map\.has-walkable/);
    assert.doesNotMatch(uiSrc, /Open weather|Black water/);
    assert.doesNotMatch(cssSrc, /lobe-west|margin-left:\s*-98%/);
    assert.match(iconSrc, /art\/toe-crane\.png/);
    assert.match(iconSrc, /art\/lattice-spike\.png/);
  });

  it("stamps glyphs on monument ids and skips duplicate names", () => {
    assert.match(uiSrc, /hasGlyph/);
    assert.match(uiSrc, /if \(zone\.monument && !hasGlyph\)/);
    assert.match(cssSrc, /left: calc\(-175 \/ 300 \* 100%\)/);
    assert.match(cssSrc, /left: calc\(-710 \/ 300 \* 100%\)/);
  });

  it("keeps the lobby hero out of the table HUD", () => {
    const lobby = htmlSrc.split('id="lobby"')[1].split('id="table"')[0];
    const table = htmlSrc.split('id="table"')[1];
    assert.match(lobby, /art\/hero-establishing-a\.png/);
    assert.match(cssSrc, /\.lobby-hero/);
    assert.doesNotMatch(table, /hero-establishing-a/);
  });

  it("draws square cores and triangle plugs, not a gable airlock", () => {
    assert.match(uiSrc, /portrait-bible/);
    assert.match(uiSrc, /art\/base-growth-bible\.png/);
    assert.match(uiSrc, /portrait-plug/);
    assert.match(uiSrc, /plugTriangle/);
    assert.match(uiSrc, /shape === "1x1"/);
    assert.match(uiSrc, /shape === "1x2"/);
    assert.match(uiSrc, /portrait-door/);
    assert.match(cssSrc, /\.portrait-plate\.shape-1x1/);
    assert.match(cssSrc, /\.portrait-plate\.shape-2x2/);
    assert.match(uiSrc, /if \(shape === "none"\) \{/);
    assert.match(htmlSrc, /portrait-ascii/);
  });
});

describe("demo seeds stay on the same island graph", () => {
  it("wipe-1 / wipe-4 / wipe-0 keep the six zones and extract path", () => {
    const seeds = expedition.demoSeeds();
    assert.equal(seeds["harbor-scrap"], "wipe-1");
    assert.equal(seeds["ridge-ore"], "wipe-4");
    assert.equal(seeds["long-shore"], "wipe-0");
    for (const seed of ["wipe-1", "wipe-4", "wipe-0"]) {
      const wipe = expedition.generateWipe(seed);
      assert.deepEqual(Object.keys(wipe.zones).sort(), ZONE_IDS.slice().sort());
      assert.ok(wipe.monuments["train-yard"]);
      assert.ok(wipe.monuments["military-tunnels"]);
      assert.equal(wipe.objective.id, "extraction-skiff");
    }
  });
});
