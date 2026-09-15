#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "data", "catalog.json");
const webJson = path.join(root, "web", "catalog.json");
const embedPath = path.join(root, "web", "catalog.embed.js");

const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const pretty = JSON.stringify(catalog, null, 2) + "\n";
const embed = "window.EMBEDDED_CATALOG = " + JSON.stringify(catalog) + ";\n";

if (process.argv.includes("--check")) {
  const jsonOk = fs.readFileSync(webJson, "utf8") === pretty;
  const embedOk = fs.readFileSync(embedPath, "utf8") === embed;
  if (!jsonOk || !embedOk) {
    console.error("Browser catalog is stale. Run: node tools/embed-catalog.js");
    process.exit(1);
  }
  console.log("Browser catalog matches data/catalog.json.");
  process.exit(0);
}

fs.mkdirSync(path.join(root, "web"), { recursive: true });
fs.writeFileSync(webJson, pretty);
fs.writeFileSync(embedPath, embed);
console.log("Wrote web/catalog.json and web/catalog.embed.js");
