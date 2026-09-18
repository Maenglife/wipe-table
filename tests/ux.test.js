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
    assert.match(uiSrc, /iconTile = zone\.isHere \|\| canMove \|\| canRecall \|\| zone\.id === "wreck"/);
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
    assert.match(uiSrc, /function activateZone/);
    assert.match(uiSrc, /zone\.move\.ok && zone\.adjacent/);
    assert.match(uiSrc, /zone\.recall\.ok/);
    assert.doesNotMatch(uiSrc, /addActionButton\(actions, "Walk"/);
    assert.doesNotMatch(uiSrc, /addActionButton\(actions, "Recall"/);
  });
});

describe("board-first expedition", () => {
  it("retires the page-wide Actions dump", () => {
    const table = htmlSrc.split('id="table"')[1].split("id=\"endDialog\"")[0];
    assert.doesNotMatch(table, /id="actionBox"/);
    assert.doesNotMatch(table, /id="actionsHeading"/);
    assert.doesNotMatch(table, /id="actions"/);
    assert.doesNotMatch(table, /expedition-actions/);
    assert.doesNotMatch(uiSrc, /Available now/);
    assert.doesNotMatch(uiSrc, /Why not/);
    assert.doesNotMatch(uiSrc, /why-not-reason/);
    assert.doesNotMatch(uiSrc, /function renderActions/);
    assert.match(htmlSrc, /id="endDayBtn"/);
  });

  it("glues 1–3 legal acts to the HERE tile and a one-line reason", () => {
    assert.match(uiSrc, /function hereActs/);
    assert.match(uiSrc, /ex-tile-acts/);
    assert.match(uiSrc, /ex-tile-reason/);
    assert.match(uiSrc, /acts\.length > 3/);
    assert.match(uiSrc, /Drop 1×1/);
    assert.match(uiSrc, /Identify wreck/);
    assert.match(uiSrc, /Take " \+ resource/);
    assert.match(cssSrc, /\.ex-tile-acts/);
    assert.match(cssSrc, /\.ex-tile-reason/);
  });

  it("walks adjacent clicks, recalls claimed beds, and ignores distant chrome", () => {
    assert.match(uiSrc, /if \(zone\.move\.ok && zone\.adjacent\)/);
    assert.match(uiSrc, /if \(zone\.recall\.ok\)/);
    assert.match(uiSrc, /addActionButton\(recallActs, "Recall"/);
    assert.match(uiSrc, /if \(chromeOnly\) return;/);
    assert.match(uiSrc, /event\.key !== "Enter"/);
    assert.match(uiSrc, /\.ex-tile-acts button/);
  });

  it("puts pack chips on the portrait edge and skiff pips on wreck", () => {
    assert.match(htmlSrc, /class="inv-rail"/);
    assert.match(htmlSrc, /portrait-stack/);
    assert.match(uiSrc, /function invChip/);
    assert.match(iconSrc, /RESOURCE_MARKS/);
    assert.match(iconSrc, /resourceMark/);
    assert.match(cssSrc, /\.inv-rail/);
    assert.match(cssSrc, /\.inv-chip/);
    assert.match(uiSrc, /function renderWreckSkiff/);
    assert.match(uiSrc, /ex-skiff/);
    assert.match(uiSrc, /type: "extract"/);
    assert.match(htmlSrc, /id="growBox"/);
    assert.match(uiSrc, /grow-base/);
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
