#!/usr/bin/env node
"use strict";

const expedition = require("../web/expedition.js");

function parseArgs(argv) {
  const args = { seed: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--seed") args.seed = argv[++i];
    else if (flag === "--json") args.json = true;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else throw new Error("Unknown argument: " + flag);
  }
  return args;
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
    console.log("Wipe Table expedition — print a seeded island\n\nUsage: node cli/expedition.js [--seed N] [--json]");
    return 0;
  }
  const wipe = expedition.generateWipe(args.seed);
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          seed: wipe.seed,
          layout: wipe.layoutId,
          featured: wipe.featured,
          hook: wipe.hook,
          monuments: wipe.monuments,
          discoveries: wipe.discoveries,
          objective: wipe.objective,
        },
        null,
        2
      )
    );
    return 0;
  }
  console.log("Expedition wipe");
  console.log("Seed: " + wipe.seed);
  console.log("Layout: " + wipe.layoutName + " (" + wipe.layoutId + ")");
  console.log("Hook: " + wipe.hook);
  console.log("Featured: " + wipe.featured);
  console.log("Discoveries: " + wipe.discoveries.join(", "));
  console.log("Train Yard @ " + wipe.zones[wipe.monuments["train-yard"]].name);
  console.log("Military Tunnels @ " + wipe.zones[wipe.monuments["military-tunnels"]].name);
  console.log("Objective: " + wipe.objective.name);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main };
