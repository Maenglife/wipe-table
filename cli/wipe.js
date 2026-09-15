#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const engine = require("../web/engine.js");

function parseArgs(argv) {
  const args = {
    catalog: path.resolve(__dirname, "../data/catalog.json"),
    sets: [],
    seed: null,
    mode: "balanced",
    json: false,
    allowCustomSize: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--catalog") args.catalog = path.resolve(argv[++i]);
    else if (flag === "--set") args.sets.push(argv[++i]);
    else if (flag === "--seed") args.seed = argv[++i];
    else if (flag === "--mode") args.mode = argv[++i];
    else if (flag === "--json") args.json = true;
    else if (flag === "--allow-custom-size") args.allowCustomSize = true;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else throw new Error("Unknown argument: " + flag);
  }
  return args;
}

function help() {
  return [
    "Wipe Table — print tonight's 10 cards",
    "",
    "Usage: node cli/wipe.js [--set survival=4] [--set monuments=3] [--set events=3]",
    "                         [--mode balanced|random] [--seed N] [--json]",
    "                         [--allow-custom-size] [--catalog path]",
    "",
    "Default mix: Survival 4 / Monuments 3 / Events 3.",
  ].join("\n");
}

function printTable(wipe, setCounts, meta, seed) {
  const total = wipe.length;
  console.log("Wipe (" + total + "): " + engine.mixLabel(setCounts));
  console.log("Mode: " + engine.modeLabel(meta.mode));
  console.log("Seed: " + seed + " · Attempts: " + meta.attempts + (meta.repaired ? " · top-end repair applied" : ""));
  if (meta.repaired) console.log("Repair: replaced a 5-cost card after seeing 3+ fives → " + meta.repair_to);
  console.log("");
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("#", 3) + pad("Card", 22) + pad("Set", 12) + pad("Band", 6) + pad("Cost", 6) + "Types");
  console.log("-".repeat(88));
  wipe.forEach((card, i) => {
    console.log(
      pad(i + 1, 3) +
        pad(card.name, 22) +
        pad(card.set, 12) +
        pad(card.band, 6) +
        pad(card.cost, 6) +
        card.types_summary
    );
  });
  const bands = engine.bandCounts(wipe);
  console.log("");
  console.log(
    "Curve: " +
      bands["2-3"] +
      " in 2–3 | " +
      bands["4"] +
      " at 4 | " +
      bands["5"] +
      " at 5 | " +
      bands.top +
      " top (6+ / event)"
  );
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (args.help) {
    console.log(help());
    return 0;
  }
  if (!args.sets.length) args.sets = ["survival=4", "monuments=3", "events=3"];

  let setCounts;
  try {
    setCounts = engine.parseSetCounts(args.sets);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  let cards;
  try {
    const data = JSON.parse(fs.readFileSync(args.catalog, "utf8"));
    cards = engine.loadCatalog(data);
  } catch (error) {
    console.error("Error loading catalog " + args.catalog + ": " + error.message);
    return 1;
  }

  const { rng, seed } = engine.makeRng(args.seed);
  let result;
  try {
    result = engine.sampleWipe(cards, setCounts, rng, 500, args.mode, args.allowCustomSize);
  } catch (error) {
    console.error("Error: " + error.message);
    return 1;
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          seed,
          set_counts: setCounts,
          meta: result.meta,
          wipe: result.wipe.map((card) => ({
            id: card.id,
            name: card.name,
            set: card.set,
            cost: card.cost,
            band: card.band,
            is_top: card.is_top,
            types: card.types,
            rules: card.rules,
          })),
        },
        null,
        2
      )
    );
  } else {
    printTable(result.wipe, setCounts, result.meta, seed);
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main };
