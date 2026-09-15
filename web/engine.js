/**
 * Wipe Table sampling engine.
 * No DOM. Safe to load in the browser or require() from Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WipeEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SET_NAMES = ["Survival", "Monuments", "Events"];
  var SET_ALIASES = {
    survival: "Survival",
    base: "Survival",
    monuments: "Monuments",
    monument: "Monuments",
    events: "Events",
    event: "Events",
  };
  var DEFAULT_COUNTS = { Survival: 4, Monuments: 3, Events: 3 };
  var BANDS = ["2-3", "4", "5"];

  function assignBand(cost) {
    var n = Number(cost);
    if (!Number.isFinite(n)) throw new Error("Card cost must be a number.");
    if (n >= 6) return "top";
    if (n === 5) return "5";
    if (n === 4) return "4";
    if (n <= 3) return "2-3";
    return "top";
  }

  function unique(values) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < values.length; i++) {
      if (!seen[values[i]]) {
        seen[values[i]] = true;
        out.push(values[i]);
      }
    }
    return out;
  }

  function loadCatalog(data) {
    if (data == null) throw new Error("Catalog is missing.");
    var cards = Array.isArray(data) ? data : data.cards;
    if (!Array.isArray(cards) || !cards.length) {
      throw new Error("Catalog must contain a nonempty list of card objects.");
    }
    var ids = Object.create(null);
    var normalized = [];
    for (var i = 0; i < cards.length; i++) {
      var raw = cards[i];
      if (!raw || typeof raw !== "object") throw new Error("Catalog cards must be objects.");
      var id = String(raw.id || "").trim();
      var name = String(raw.name || "").trim();
      var setName = String(raw.set || "").trim();
      if (!id) throw new Error("Each card needs an id.");
      if (ids[id]) throw new Error("Duplicate card id: " + id);
      ids[id] = true;
      if (!name) throw new Error("Card " + id + " needs a name.");
      if (SET_NAMES.indexOf(setName) === -1) {
        throw new Error("Card " + id + " has unknown set " + setName + ".");
      }
      var cost = Number(raw.cost);
      if (!Number.isSafeInteger(cost) || cost < 0) {
        throw new Error("Card " + id + " needs a whole-number cost.");
      }
      var band = assignBand(cost);
      var types = Array.isArray(raw.types) ? raw.types.map(String) : [];
      normalized.push({
        id: id,
        name: name,
        set: setName,
        cost: cost,
        band: band,
        is_top: band === "top",
        types: types,
        types_summary: types.join(" / "),
        rules: String(raw.rules || "").trim(),
        flavor: String(raw.flavor || "").trim(),
        icon: String(raw.icon || "mark"),
      });
    }
    return normalized;
  }

  function groupBySet(cards) {
    var pools = Object.create(null);
    for (var i = 0; i < SET_NAMES.length; i++) pools[SET_NAMES[i]] = [];
    for (var j = 0; j < cards.length; j++) {
      var card = cards[j];
      if (!pools[card.set]) pools[card.set] = [];
      pools[card.set].push(card);
    }
    return pools;
  }

  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seedInput) {
    if (seedInput === "" || seedInput == null) {
      var generated = (Math.random() * 0xffffffff) >>> 0;
      return { rng: mulberry32(generated), seed: String(generated) };
    }
    var raw = String(seedInput).trim();
    var s;
    if (/^\d+$/.test(raw)) {
      s = Number(BigInt(raw) % 4294967296n) >>> 0;
      if (s === 0 && raw !== "0") s = hashSeed(raw);
    } else {
      s = hashSeed(raw);
    }
    return { rng: mulberry32(s), seed: raw };
  }

  function shuffleInPlace(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function sample(arr, k, rng) {
    if (k > arr.length) throw new Error("sample larger than population");
    var copy = arr.slice();
    shuffleInPlace(copy, rng);
    return copy.slice(0, k);
  }

  function choice(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function meetsBaseCurve(wipe) {
    var b23 = 0;
    var b4 = 0;
    var b5 = 0;
    for (var i = 0; i < wipe.length; i++) {
      if (wipe[i].band === "2-3") b23++;
      else if (wipe[i].band === "4") b4++;
      else if (wipe[i].band === "5") b5++;
    }
    return b23 >= 2 && b4 >= 2 && b5 >= 2;
  }

  function needsTopRepair(wipe) {
    var fives = 0;
    var tops = 0;
    for (var i = 0; i < wipe.length; i++) {
      if (wipe[i].band === "5") fives++;
      if (wipe[i].is_top) tops++;
    }
    return fives >= 3 && tops === 0;
  }

  function repairTopEnd(wipe, pools, rng) {
    if (!needsTopRepair(wipe)) return wipe;
    var fives = wipe.filter(function (c) {
      return c.band === "5";
    });
    shuffleInPlace(fives, rng);
    var used = Object.create(null);
    for (var i = 0; i < wipe.length; i++) used[wipe[i].id] = true;
    for (var v = 0; v < fives.length; v++) {
      var victim = fives[v];
      var candidates = (pools[victim.set] || []).filter(function (c) {
        return c.is_top && !used[c.id];
      });
      if (!candidates.length) continue;
      var replacement = choice(candidates, rng);
      return wipe.map(function (c) {
        return c.id === victim.id ? replacement : c;
      });
    }
    return null;
  }

  function validateSetCounts(setCounts, pools, mode, allowCustomSize) {
    mode = mode || "balanced";
    allowCustomSize = !!allowCustomSize;
    if (mode !== "balanced" && mode !== "random") {
      throw new Error("Unknown mode. Use balanced or random.");
    }
    if (!setCounts || typeof setCounts !== "object" || Array.isArray(setCounts)) {
      throw new Error("Choose at least one wipe card.");
    }
    var entries = Object.entries(setCounts);
    if (!entries.length) throw new Error("Choose at least one wipe card.");
    for (var i = 0; i < entries.length; i++) {
      var setName = entries[i][0];
      var need = entries[i][1];
      if (!Object.prototype.hasOwnProperty.call(pools, setName)) {
        throw new Error("Unknown set: " + setName);
      }
      if (!Number.isSafeInteger(need) || need < 0) {
        throw new Error("Count for " + setName + " must be a nonnegative whole number.");
      }
      if (need > pools[setName].length) {
        throw new Error(
          "Requested " + need + " from " + setName + ", but only " + pools[setName].length + " cards exist."
        );
      }
    }
    var total = entries.reduce(function (sum, pair) {
      return sum + pair[1];
    }, 0);
    if (!total) throw new Error("Choose at least one wipe card.");
    if (total !== 10 && !allowCustomSize) {
      throw new Error("Choose exactly 10 cards, or allow a custom size under Advanced.");
    }
    if (mode !== "balanced") return;
    if (total < 6) {
      throw new Error("Balanced costs needs at least 6 cards; add more or choose Pure random.");
    }
    for (var mask = 1; mask < 8; mask++) {
      var required = BANDS.filter(function (_band, index) {
        return mask & (1 << index);
      });
      var available = entries.reduce(function (sum, pair) {
        var name = pair[0];
        var count = pair[1];
        var matching = pools[name].filter(function (card) {
          return required.indexOf(card.band) !== -1;
        }).length;
        return sum + Math.min(count, matching);
      }, 0);
      if (available < 2 * required.length) {
        throw new Error("This mix cannot meet the balanced cost minimums; adjust the mix or choose Pure random.");
      }
    }
    var hasTop = entries.some(function (pair) {
      return pair[1] > 0 && pools[pair[0]].some(function (card) {
        return card.is_top;
      });
    });
    var forcedFives = entries.reduce(function (sum, pair) {
      var nonFive = pools[pair[0]].filter(function (card) {
        return card.band !== "5";
      }).length;
      return sum + Math.max(0, pair[1] - nonFive);
    }, 0);
    if (!hasTop && forcedFives >= 3) {
      throw new Error("This mix needs a 6+/event option for Balanced costs; adjust the mix or choose Pure random.");
    }
  }

  function compareCards(a, b) {
    if (a.set !== b.set) return a.set < b.set ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.name !== b.name) return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    return 0;
  }

  function sampleWipe(cards, setCounts, rng, maxAttempts, mode, allowCustomSize) {
    maxAttempts = maxAttempts || 500;
    mode = mode || "balanced";
    var pools = groupBySet(cards);
    validateSetCounts(setCounts, pools, mode, allowCustomSize);

    var meta = { mode: mode, attempts: 0, repaired: false, repair_from: null, repair_to: null };

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      meta.attempts = attempt;
      var wipe = [];
      var names = Object.keys(setCounts);
      for (var i = 0; i < names.length; i++) {
        var need = setCounts[names[i]];
        if (need > 0) wipe = wipe.concat(sample(pools[names[i]], need, rng));
      }
      if (mode === "balanced" && !meetsBaseCurve(wipe)) continue;

      if (mode === "balanced" && needsTopRepair(wipe)) {
        var beforeFives = wipe
          .filter(function (c) {
            return c.band === "5";
          })
          .map(function (c) {
            return c.name;
          })
          .sort();
        var repaired = repairTopEnd(wipe, pools, rng);
        if (!repaired) continue;
        if (!meetsBaseCurve(repaired)) continue;
        var afterTops = repaired.filter(function (c) {
          return c.is_top;
        });
        if (!afterTops.length) continue;
        meta.repaired = true;
        meta.repair_from = beforeFives;
        meta.repair_to = afterTops[0].name;
        wipe = repaired;
      }

      wipe = wipe.slice().sort(compareCards);
      return { wipe: wipe, meta: meta };
    }

    throw new Error(
      "Could not find a valid wipe in " +
        maxAttempts +
        " attempts. Try different set counts or Pure random mode."
    );
  }

  function bandCounts(wipe) {
    var counts = { "2-3": 0, "4": 0, "5": 0, top: 0 };
    for (var i = 0; i < wipe.length; i++) {
      if (counts[wipe[i].band] != null) counts[wipe[i].band]++;
      else if (wipe[i].is_top) counts.top++;
    }
    return counts;
  }

  function modeLabel(mode) {
    return mode === "random" ? "Pure random" : "Balanced costs";
  }

  function mixLabel(setCounts) {
    return SET_NAMES.filter(function (name) {
      return setCounts[name];
    })
      .map(function (name) {
        return name + " " + setCounts[name];
      })
      .join(" / ");
  }

  function formatWipeText(wipe, setCounts, meta, seed) {
    var lines = [
      "Wipe Table — tonight's wipe",
      "Seed: " + seed,
      "Mode: " + modeLabel(meta && meta.mode),
      "Mix: " + mixLabel(setCounts),
      "",
    ];
    for (var i = 0; i < wipe.length; i++) {
      var card = wipe[i];
      lines.push(
        i + 1 + ". " + card.name + " (" + card.cost + ") — " + card.set + " — " + card.types_summary
      );
    }
    return lines.join("\n");
  }

  function parseSetCounts(values) {
    var counts = {};
    for (var i = 0; i < values.length; i++) {
      var raw = values[i];
      if (raw.indexOf("=") === -1) throw new Error("Expected SET=COUNT, got " + raw);
      var parts = raw.split("=");
      var alias = parts[0].trim().toLowerCase();
      var key = SET_ALIASES[alias];
      if (!key) throw new Error("Unknown set " + parts[0] + ". Use survival, monuments, or events.");
      var count = Number(parts[1]);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Count must be a nonnegative integer.");
      counts[key] = (counts[key] || 0) + count;
    }
    return counts;
  }

  return {
    SET_NAMES: SET_NAMES,
    SET_ALIASES: SET_ALIASES,
    DEFAULT_COUNTS: DEFAULT_COUNTS,
    assignBand: assignBand,
    loadCatalog: loadCatalog,
    groupBySet: groupBySet,
    validateSetCounts: validateSetCounts,
    sampleWipe: sampleWipe,
    meetsBaseCurve: meetsBaseCurve,
    needsTopRepair: needsTopRepair,
    repairTopEnd: repairTopEnd,
    makeRng: makeRng,
    mulberry32: mulberry32,
    bandCounts: bandCounts,
    formatWipeText: formatWipeText,
    modeLabel: modeLabel,
    mixLabel: mixLabel,
    parseSetCounts: parseSetCounts,
    unique: unique,
  };
});
