"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const expedition = require("../web/expedition.js");

const uiSrc = fs.readFileSync(path.join(__dirname, "../web/expedition-ui.js"), "utf8");
const htmlSrc = fs.readFileSync(path.join(__dirname, "../web/expedition.html"), "utf8");
const cssSrc = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8");
const iconSrc = fs.readFileSync(path.join(__dirname, "../web/icons.js"), "utf8");
const engineSrc = fs.readFileSync(path.join(__dirname, "../web/expedition.js"), "utf8");

const ZONE_IDS = ["camp", "wreck", "woods", "industrial", "ridge", "far"];

describe("sticky skiff strip", () => {
  it("pins a compact #objective strip under play-status on #table", () => {
    const table = htmlSrc.split('id="table"')[1].split("id=\"endDialog\"")[0];
    assert.match(table, /id="objective"/);
    assert.match(table, /class="skiff-strip"/);
    assert.match(table, /id="objectiveTrack"/);
    assert.match(table, /id="objectiveHelp"/);
    const statusAt = table.indexOf("play-status");
    const stripAt = table.indexOf("skiff-strip");
    assert.ok(statusAt !== -1 && stripAt > statusAt);
    assert.match(cssSrc, /\.skiff-strip\s*\{[^}]*position:\s*sticky/s);
    assert.match(cssSrc, /\.skiff-strip\s*\{[^}]*top:\s*var\(--header-h\)/s);
    assert.match(uiSrc, /skiff-pip/);
    assert.match(uiSrc, /Pontoon plate/);
    assert.match(uiSrc, /Starter coil/);
    assert.match(uiSrc, /Fuel kit/);
    assert.match(uiSrc, /Assembled/);
    assert.doesNotMatch(table, /objective-panel/);
  });
});

describe("map presentation", () => {
  it("uses icon tiles for HERE and walkable nodes with name captions", () => {
    ZONE_IDS.forEach((id) => {
      assert.match(iconSrc, new RegExp(id + ":\\s*function"));
    });
    assert.match(iconSrc, /ZONE_STAMPS/);
    assert.match(iconSrc, /zoneStamp/);
    assert.match(uiSrc, /is-icon/);
    assert.match(uiSrc, /ex-zone-caption/);
    assert.match(uiSrc, /ex-stamp/);
    assert.match(uiSrc, /iconTile = zone\.isHere \|\| canMove/);
  });

  it("keeps Spike/Crane monument stamps and skips duplicate names", () => {
    assert.match(uiSrc, /art\/toe-crane\.png/);
    assert.match(uiSrc, /art\/lattice-spike\.png/);
    assert.match(uiSrc, /hasGlyph/);
    assert.match(uiSrc, /if \(zone\.monument && !hasGlyph\)/);
  });

  it("treats distant unclaimed ground as chrome-only with name on hover/focus", () => {
    assert.match(uiSrc, /chromeOnly/);
    assert.match(uiSrc, /is-distant is-chrome/);
    assert.match(cssSrc, /\.ex-zone\.is-chrome:hover \.ex-zone-caption/);
    assert.match(cssSrc, /\.ex-zone\.is-chrome:focus-visible \.ex-zone-caption/);
    assert.match(cssSrc, /\.ex-zone\.is-claimed:not\(\.is-chrome\)/);
  });

  it("marks HERE with a single banner and walkable with path+border only", () => {
    assert.match(uiSrc, /ex-here-banner/);
    assert.doesNotMatch(uiSrc, /ex-chip-here/);
    assert.doesNotMatch(uiSrc, /ex-chip-walk/);
    assert.match(cssSrc, /\.ex-here-banner/);
    assert.match(cssSrc, /\.ex-zone\.is-walkable\s*\{[^}]*box-shadow:\s*none/s);
    assert.doesNotMatch(cssSrc, /0 0 18px rgba\(212, 120, 46/);
    assert.match(uiSrc, /ex-path-line/);
    assert.match(uiSrc, /addActionButton\(actions, "Walk"/);
    assert.match(uiSrc, /addActionButton\(actions, "Recall"/);
  });
});

describe("legal-only action strip", () => {
  it("shows available verbs and collapses the rest under Why not with visible reasons", () => {
    assert.match(uiSrc, /Available now/);
    assert.match(uiSrc, /Why not/);
    assert.match(uiSrc, /why-not-reason/);
    assert.match(cssSrc, /\.why-not/);
    assert.match(uiSrc, /blocked\.forEach/);
    assert.match(uiSrc, /item\.check\.reason/);
    assert.doesNotMatch(uiSrc, /field-label", "Gather"/);
    assert.doesNotMatch(uiSrc, /Search & leave/);
  });
});

describe("presentation-only contract", () => {
  it("does not add layouts, monuments, or economy rules", () => {
    assert.equal(expedition.LAYOUTS.length, 3);
    assert.deepEqual(Object.keys(expedition.MONUMENTS).sort(), ["military-tunnels", "train-yard"]);
    assert.deepEqual(Object.keys(expedition.ZONE_META).sort(), ZONE_IDS.slice().sort());
    assert.match(engineSrc, /extraction-skiff/);
    assert.doesNotMatch(uiSrc, /lobe-west|margin-left:\s*-98%/);
  });
});
