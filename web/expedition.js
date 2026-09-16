/**
 * Wipe Table Expedition — solo building-and-expedition engine.
 * No DOM. Safe to load in the browser or require() from Node.
 * No combat. Ending is player-triggered extraction.
 */
(function (root, factory) {
  var engine;
  if (typeof module === "object" && module.exports) {
    engine = require("./engine.js");
    module.exports = factory(engine);
  } else {
    engine = root.WipeEngine;
    root.WipeExpedition = factory(engine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  var VERSION = 1;
  var STORAGE_VERSION = 1;
  var ACTIONS_PER_DAY = 4;
  var LOG_CAP = 36;
  var DEFAULT_CAP = 14;
  var STORAGE_CAP = 20;
  var RESOURCES = ["wood", "stone", "cloth", "ore", "components", "metal", "scrap"];

  var STARTER_KNOWN = ["sleeping-bag"];

  var BLUEPRINTS = {
    "sleeping-bag": {
      id: "sleeping-bag",
      name: "Sleeping Bag",
      icon: "bag",
      kind: "kit",
      station: "bag",
      cost: { cloth: 2 },
      catalogId: "sleeping-bag",
      summary: "A spare bed. Install it in a room so you can recall here.",
    },
    furnace: {
      id: "furnace",
      name: "Furnace",
      icon: "fire",
      kind: "kit",
      station: "furnace",
      cost: { stone: 2, wood: 1 },
      summary: "Install in a room. Smelt 2 ore into 1 metal.",
    },
    recycler: {
      id: "recycler",
      name: "Recycler",
      icon: "recycler",
      kind: "kit",
      station: "recycler",
      cost: { components: 2, wood: 1 },
      catalogId: "recycler",
      summary: "Install in a room. Turn 2 components into 1 scrap.",
    },
    "tool-cupboard": {
      id: "tool-cupboard",
      name: "Tool Cupboard",
      icon: "cupboard",
      kind: "kit",
      station: "cupboard",
      cost: { wood: 2, stone: 1 },
      catalogId: "tool-cupboard",
      summary: "Install at camp to authorize a remote outpost.",
    },
    "stone-hatchet": {
      id: "stone-hatchet",
      name: "Stone Hatchet",
      icon: "hatchet",
      kind: "tool",
      cost: { wood: 2, stone: 1 },
      catalogId: "stone-hatchet",
      summary: "Keep it. Wood and stone gathers yield +1.",
    },
    workbench: {
      id: "workbench",
      name: "Workbench",
      icon: "workbench",
      kind: "kit",
      station: "workbench",
      cost: { wood: 2, stone: 1 },
      catalogId: "workbench-three",
      summary: "Install in a room. Fuel kits cost less.",
    },
    "garage-door": {
      id: "garage-door",
      name: "Garage Door",
      icon: "garage",
      kind: "kit",
      station: "storage",
      cost: { wood: 1, stone: 2 },
      catalogId: "garage-door",
      summary: "Install as a storage room. Carry more on the trail.",
    },
  };

  var DISCOVERY_POOL = ["furnace", "recycler", "tool-cupboard", "stone-hatchet", "workbench", "garage-door"];

  var MONUMENTS = {
    "train-yard": {
      id: "train-yard",
      name: "Train Yard",
      catalogId: "train-yard",
      part: "pontoon",
      partName: "Pontoon plate",
      flavor: "Hopper cars and a bent float that still wants water.",
    },
    "military-tunnels": {
      id: "military-tunnels",
      name: "Military Tunnels",
      catalogId: "military-tunnels",
      part: "coil",
      partName: "Starter coil",
      flavor: "A concrete throat. The crate is labeled in a language of bolts.",
    },
  };

  var ZONE_META = {
    camp: { id: "camp", name: "Shore Camp", terrain: "buildable beach", col: 1, row: 2 },
    wreck: { id: "wreck", name: "Wreck Beach", terrain: "shingle and ribs", col: 1, row: 3 },
    woods: { id: "woods", name: "Coast Woods", terrain: "pine and path", col: 2, row: 2 },
    industrial: { id: "industrial", name: "Industrial Shelf", terrain: "sheet and gravel", col: 3, row: 2 },
    ridge: { id: "ridge", name: "Inland Ridge", terrain: "rock and scrub", col: 2, row: 1 },
    far: { id: "far", name: "Far Spine", terrain: "high ground", col: 3, row: 1 },
  };

  var ADJACENT = {
    camp: ["woods", "wreck"],
    wreck: ["camp"],
    woods: ["camp", "industrial", "ridge"],
    industrial: ["woods"],
    ridge: ["woods", "far"],
    far: ["ridge"],
  };

  var LAYOUTS = [
    {
      id: "harbor-scrap",
      name: "Harbor scrap",
      featured: "recycler",
      hook: "Components pile against the industrial fence. Stay compact and process them.",
      contrast:
        "This wipe rewarded a compact recycling workshop — small home, short runs to Train Yard.",
      monuments: { "train-yard": "industrial", "military-tunnels": "ridge" },
      nodes: {
        camp: { wood: 2, stone: 1 },
        wreck: { cloth: 2 },
        woods: { wood: 3 },
        industrial: { components: 3, stone: 1 },
        ridge: { stone: 2 },
        far: { cloth: 1, ore: 1 },
      },
    },
    {
      id: "ridge-ore",
      name: "Inland ore",
      featured: "furnace",
      hook: "The richest ore sits inland. Expand the shack into a furnace line.",
      contrast:
        "This wipe rewarded a furnace-heavy base with storage and processing — you hauled ore home.",
      monuments: { "train-yard": "woods", "military-tunnels": "far" },
      nodes: {
        camp: { wood: 2 },
        wreck: { cloth: 2 },
        woods: { wood: 2, stone: 2 },
        industrial: { components: 1, stone: 1 },
        ridge: { ore: 3, stone: 1 },
        far: { ore: 2, cloth: 1 },
      },
    },
    {
      id: "long-shore",
      name: "Long route",
      featured: "tool-cupboard",
      hook: "Two monuments sit on a long walk. Keep home small and plant an outpost.",
      contrast:
        "This wipe rewarded a small main base plus an expedition outpost on the far spine.",
      monuments: { "train-yard": "industrial", "military-tunnels": "far" },
      nodes: {
        camp: { wood: 2, stone: 1 },
        wreck: { cloth: 2 },
        woods: { wood: 2 },
        industrial: { components: 2, stone: 1 },
        ridge: { ore: 1, stone: 1 },
        far: { components: 2, cloth: 1 },
      },
    },
  ];

  var STATION_GLYPH = {
    bag: "B",
    furnace: "F",
    recycler: "R",
    cupboard: "C",
    workbench: "W",
    storage: "G",
  };

  var STATION_LABEL = {
    bag: "Bag",
    furnace: "Furnace",
    recycler: "Recycler",
    cupboard: "Cupboard",
    workbench: "Workbench",
    storage: "Storage",
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function layoutById(id) {
    for (var i = 0; i < LAYOUTS.length; i++) {
      if (LAYOUTS[i].id === id) return LAYOUTS[i];
    }
    return null;
  }

  function pickDiscoveries(layout, rng) {
    var featured = layout.featured;
    var rest = DISCOVERY_POOL.filter(function (id) {
      return id !== featured;
    });
    shuffleInPlace(rest, rng);
    var extras = rest.slice(0, 3);
    if (layout.id === "long-shore") {
      var hasProcessor =
        extras.indexOf("furnace") !== -1 || extras.indexOf("recycler") !== -1;
      if (!hasProcessor) {
        var processor = rng() < 0.5 ? "furnace" : "recycler";
        var without = extras.filter(function (id) {
          return id !== processor;
        });
        extras = without.slice(0, 2).concat([processor]);
      }
    }
    return [featured].concat(extras);
  }

  function buildZones(layout) {
    var zones = {};
    Object.keys(ZONE_META).forEach(function (id) {
      var meta = ZONE_META[id];
      zones[id] = {
        id: id,
        name: meta.name,
        terrain: meta.terrain,
        col: meta.col,
        row: meta.row,
        nodes: clone(layout.nodes[id] || {}),
        monument: null,
        buildable: id !== "wreck",
      };
    });
    Object.keys(layout.monuments).forEach(function (monumentId) {
      var zoneId = layout.monuments[monumentId];
      zones[zoneId].monument = monumentId;
    });
    return zones;
  }

  function generateWipe(seedInput) {
    var pack = engine.makeRng(seedInput);
    var rng = pack.rng;
    var layout = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
    var discoveries = pickDiscoveries(layout, rng);
    return {
      seed: pack.seed,
      layoutId: layout.id,
      layoutName: layout.name,
      featured: layout.featured,
      hook: layout.hook,
      contrast: layout.contrast,
      monuments: clone(layout.monuments),
      zones: buildZones(layout),
      discoveries: discoveries.slice(),
      discoveryQueue: discoveries.slice(),
      objective: {
        id: "extraction-skiff",
        name: "Repair the extraction skiff",
        summary:
          "A broken work boat on Wreck Beach. Retrieve a pontoon plate and a starter coil from the two monuments, craft a fuel kit at a claimed site, assemble the skiff, and leave when you choose.",
      },
    };
  }

  function emptyInventory() {
    var inv = {};
    RESOURCES.forEach(function (key) {
      inv[key] = 0;
    });
    return inv;
  }

  function startingInventory() {
    var inv = emptyInventory();
    inv.wood = 2;
    inv.stone = 1;
    inv.cloth = 1;
    return inv;
  }

  function resourceTotal(inv) {
    return RESOURCES.reduce(function (sum, key) {
      return sum + (Number(inv[key]) || 0);
    }, 0);
  }

  function hasStation(state, station, zoneId) {
    var rooms;
    if (zoneId === "camp") rooms = state.base.camp.rooms;
    else if (state.base.outposts[zoneId]) rooms = state.base.outposts[zoneId].rooms;
    else return false;
    return rooms.some(function (room) {
      return room.station === station;
    });
  }

  function cupboardAtCamp(state) {
    return hasStation(state, "cupboard", "camp");
  }

  function claimedSites(state) {
    var sites = [];
    if (state.base.camp.shape !== "none") sites.push("camp");
    Object.keys(state.base.outposts).forEach(function (id) {
      sites.push(id);
    });
    return sites;
  }

  function isClaimed(state, zoneId) {
    return claimedSites(state).indexOf(zoneId) !== -1;
  }

  function siteRooms(state, zoneId) {
    if (zoneId === "camp") return state.base.camp.rooms;
    if (state.base.outposts[zoneId]) return state.base.outposts[zoneId].rooms;
    return null;
  }

  function emptyRoomIndex(rooms) {
    if (!rooms) return -1;
    for (var i = 0; i < rooms.length; i++) {
      if (!rooms[i].station) return i;
    }
    return -1;
  }

  function carryCap(state) {
    var extra = false;
    if (hasStation(state, "storage", "camp")) extra = true;
    Object.keys(state.base.outposts).forEach(function (id) {
      if (hasStation(state, "storage", id)) extra = true;
    });
    return extra ? STORAGE_CAP : DEFAULT_CAP;
  }

  function knownHas(state, id) {
    return state.player.known.indexOf(id) !== -1;
  }

  function pushLog(state, line) {
    state.log.push(line);
    if (state.log.length > LOG_CAP) state.log = state.log.slice(-LOG_CAP);
  }

  function spendCost(inv, cost) {
    Object.keys(cost).forEach(function (key) {
      inv[key] -= cost[key];
    });
  }

  function canPay(inv, cost) {
    return Object.keys(cost).every(function (key) {
      return (inv[key] || 0) >= cost[key];
    });
  }

  function costLabel(cost) {
    return Object.keys(cost)
      .filter(function (key) {
        return cost[key] > 0;
      })
      .map(function (key) {
        return cost[key] + " " + key;
      })
      .join(", ");
  }

  function fuelCost(state) {
    if (hasStation(state, "workbench", state.player.location) || hasStation(state, "workbench", "camp")) {
      return { processed: 1, wood: 1 };
    }
    return { processed: 1, wood: 1 };
  }

  function createGame(options) {
    options = options || {};
    var wipe = options.wipe ? clone(options.wipe) : generateWipe(options.seed);
    if (options.seed != null && !options.wipe) {
      wipe = generateWipe(options.seed);
    }
    var name = String(options.name || "").trim();
    if (name.length > 32) name = name.slice(0, 32);
    var state = {
      version: VERSION,
      seed: wipe.seed,
      wipe: wipe,
      player: {
        name: name || "Survivor",
        location: "camp",
        inventory: startingInventory(),
        kits: [],
        hatchet: false,
        known: STARTER_KNOWN.slice(),
        revealed: [],
      },
      boat: {
        seen: false,
        parts: { pontoon: false, coil: false, fuel: false },
        assembled: false,
      },
      base: {
        camp: { shape: "none", rooms: [] },
        outposts: {},
      },
      monuments: {
        "train-yard": { visits: 0 },
        "military-tunnels": { visits: 0 },
      },
      route: ["camp"],
      day: 1,
      actionsLeft: ACTIONS_PER_DAY,
      actionsTaken: 0,
      log: [],
      ended: null,
    };
    pushLog(
      state,
      "Wipe " +
        wipe.seed +
        " — " +
        wipe.layoutName +
        ". " +
        wipe.hook +
        " A broken skiff waits on Wreck Beach."
    );
    return state;
  }

  function nextDay(state, reason) {
    state.day += 1;
    state.actionsLeft = ACTIONS_PER_DAY;
    pushLog(state, (reason || "Day ended.") + " Day " + state.day + ".");
  }

  function spendAction(state, line) {
    state.actionsLeft -= 1;
    state.actionsTaken += 1;
    if (line) pushLog(state, line);
    if (!state.ended && state.actionsLeft <= 0) nextDay(state, "Actions spent.");
  }

  function noteVisit(state, zoneId) {
    if (state.route[state.route.length - 1] !== zoneId) state.route.push(zoneId);
  }

  function inspectMove(state, zoneId) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    if (!ZONE_META[zoneId]) return { ok: false, reason: "Unknown zone." };
    if (zoneId === state.player.location) return { ok: false, reason: "Already here." };
    var here = state.player.location;
    var adjacent = ADJACENT[here].indexOf(zoneId) !== -1;
    var fast = isClaimed(state, here) && isClaimed(state, zoneId);
    if (!adjacent && !fast) {
      return { ok: false, reason: "Not adjacent. Claim an outpost to skip the walk." };
    }
    return { ok: true, reason: fast && !adjacent ? "Fast travel between claimed sites." : "" };
  }

  function inspectRecall(state, zoneId) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    zoneId = zoneId || "camp";
    if (!isClaimed(state, zoneId)) {
      return { ok: false, reason: zoneId === "camp" ? "Build a 1×1 before you can recall." : "No outpost there." };
    }
    if (state.player.location === zoneId) return { ok: false, reason: "Already here." };
    var rooms = siteRooms(state, zoneId) || [];
    var hasBed =
      zoneId === "camp" ||
      rooms.some(function (room) {
        return room.station === "bag";
      });
    if (!hasBed) {
      return { ok: false, reason: "Plant a sleeping bag at the outpost before recalling to it." };
    }
    return { ok: true, reason: "" };
  }

  function inspectGather(state, resource) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    var zone = state.wipe.zones[state.player.location];
    var nodes = zone.nodes || {};
    var keys = Object.keys(nodes).filter(function (key) {
      return nodes[key] > 0;
    });
    if (!keys.length) return { ok: false, reason: "Nothing to gather here." };
    if (!resource) return { ok: true, reason: "", resources: keys };
    if (keys.indexOf(resource) === -1) {
      return { ok: false, reason: "No " + resource + " node in this zone." };
    }
    var yieldAmt = nodes[resource];
    if (state.player.hatchet && (resource === "wood" || resource === "stone")) yieldAmt += 1;
    if (resourceTotal(state.player.inventory) + yieldAmt > carryCap(state)) {
      return { ok: false, reason: "Pack is full (" + carryCap(state) + "). Store or spend first." };
    }
    return { ok: true, reason: "", yield: yieldAmt };
  }

  function inspectBuild(state, structure) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    var loc = state.player.location;
    var inv = state.player.inventory;
    if (structure === "shack") {
      if (loc !== "camp") return { ok: false, reason: "The first shack goes on Shore Camp." };
      if (state.base.camp.shape !== "none") return { ok: false, reason: "The 1×1 is already up." };
      if (!canPay(inv, { wood: 2 })) return { ok: false, reason: "Need 2 wood for a 1×1." };
      return { ok: true, reason: "", cost: { wood: 2 } };
    }
    if (structure === "expand-1x2") {
      if (loc !== "camp") return { ok: false, reason: "Expand the main base at camp." };
      if (state.base.camp.shape !== "1x1") return { ok: false, reason: "Drop the 1×1 first." };
      if (!canPay(inv, { wood: 2, stone: 1 })) return { ok: false, reason: "Need 2 wood and 1 stone." };
      return { ok: true, reason: "", cost: { wood: 2, stone: 1 } };
    }
    if (structure === "expand-2x2") {
      if (loc !== "camp") return { ok: false, reason: "Expand the main base at camp." };
      if (state.base.camp.shape !== "1x2") return { ok: false, reason: "Stretch to a 1×2 first." };
      if (!canPay(inv, { wood: 2, stone: 2 })) return { ok: false, reason: "Need 2 wood and 2 stone." };
      return { ok: true, reason: "", cost: { wood: 2, stone: 2 } };
    }
    if (structure === "outpost") {
      if (loc === "camp") return { ok: false, reason: "Camp is the main base, not an outpost." };
      if (!state.wipe.zones[loc].buildable) return { ok: false, reason: "Cannot claim this shore." };
      if (state.base.outposts[loc]) return { ok: false, reason: "Outpost already stands here." };
      if (!cupboardAtCamp(state)) {
        return { ok: false, reason: "Install a Tool Cupboard at camp first." };
      }
      if (!canPay(inv, { wood: 2, stone: 1 })) return { ok: false, reason: "Need 2 wood and 1 stone." };
      return { ok: true, reason: "", cost: { wood: 2, stone: 1 } };
    }
    return { ok: false, reason: "Unknown structure." };
  }

  function inspectCraft(state, recipeId) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    var inv = state.player.inventory;
    var loc = state.player.location;

    if (recipeId === "smelt") {
      if (!isClaimed(state, loc) || !hasStation(state, "furnace", loc)) {
        return { ok: false, reason: "Smelt at a claimed site with a furnace." };
      }
      if (inv.ore < 2) return { ok: false, reason: "Need 2 ore." };
      if (resourceTotal(inv) - 2 + 1 > carryCap(state)) {
        return { ok: false, reason: "Pack is full." };
      }
      return { ok: true, reason: "" };
    }
    if (recipeId === "recycle") {
      if (!isClaimed(state, loc) || !hasStation(state, "recycler", loc)) {
        return { ok: false, reason: "Recycle at a claimed site with a recycler." };
      }
      if (inv.components < 2) return { ok: false, reason: "Need 2 components." };
      if (resourceTotal(inv) - 2 + 1 > carryCap(state)) {
        return { ok: false, reason: "Pack is full." };
      }
      return { ok: true, reason: "" };
    }
    if (recipeId === "fuel-kit") {
      if (!isClaimed(state, loc)) return { ok: false, reason: "Prepare fuel at a claimed site." };
      if (state.boat.parts.fuel) return { ok: false, reason: "Fuel kit is already made." };
      var cheap = hasStation(state, "workbench", loc);
      var processedNeed = cheap ? 1 : 1;
      var woodNeed = cheap ? 0 : 1;
      var hasProcessed = inv.metal >= processedNeed || inv.scrap >= processedNeed;
      var hasRaw =
        (inv.components >= 3 && inv.wood >= 2) || (inv.ore >= 3 && inv.wood >= 2);
      if (hasProcessed && inv.wood >= woodNeed) return { ok: true, reason: "", path: "processed", cheap: cheap };
      if (hasRaw) return { ok: true, reason: "", path: "raw" };
      if (cheap) {
        return { ok: false, reason: "Need 1 metal or 1 scrap (workbench), or 3 components/ore and 2 wood." };
      }
      return { ok: false, reason: "Need 1 metal or 1 scrap plus 1 wood, or 3 components/ore and 2 wood." };
    }

    var bp = BLUEPRINTS[recipeId];
    if (!bp) return { ok: false, reason: "Unknown recipe." };
    if (!knownHas(state, recipeId)) return { ok: false, reason: "You have not discovered " + bp.name + " yet." };
    if (bp.kind === "tool" && state.player.hatchet) return { ok: false, reason: "Hatchet is already in hand." };
    if (bp.kind === "kit" && state.player.kits.indexOf(recipeId) !== -1) {
      return { ok: false, reason: "A " + bp.name + " kit is already in the pack." };
    }
    if (!isClaimed(state, loc) && recipeId !== "sleeping-bag" && recipeId !== "stone-hatchet") {
      return { ok: false, reason: "Craft kits at a claimed site." };
    }
    if (!canPay(inv, bp.cost)) return { ok: false, reason: "Need " + costLabel(bp.cost) + "." };
    return { ok: true, reason: "", cost: bp.cost };
  }

  function inspectInstall(state, kitId, roomIndex) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    var loc = state.player.location;
    var rooms = siteRooms(state, loc);
    if (!rooms) return { ok: false, reason: "No claimed rooms here." };
    var kit = kitId || state.player.kits[0];
    if (!kit || state.player.kits.indexOf(kit) === -1) {
      return { ok: false, reason: "No kit in the pack." };
    }
    var bp = BLUEPRINTS[kit];
    if (!bp || !bp.station) return { ok: false, reason: "That kit does not install." };
    var idx = roomIndex == null ? emptyRoomIndex(rooms) : Number(roomIndex);
    if (!rooms[idx]) return { ok: false, reason: "No such room." };
    if (rooms[idx].station) return { ok: false, reason: "That room is already filled." };
    return { ok: true, reason: "", kit: kit, roomIndex: idx };
  }

  function inspectExplore(state) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    var loc = state.player.location;
    if (loc === "wreck") {
      if (state.boat.seen) return { ok: false, reason: "The skiff is already identified. Bring parts back here." };
      return { ok: true, reason: "", target: "wreck" };
    }
    var monumentId = state.wipe.zones[loc].monument;
    if (!monumentId) return { ok: false, reason: "No monument in this zone." };
    return { ok: true, reason: "", target: monumentId };
  }

  function inspectAssemble(state) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    if (state.player.location !== "wreck") return { ok: false, reason: "Assemble the skiff on Wreck Beach." };
    if (!state.boat.seen) return { ok: false, reason: "Search the wreck so you know what to repair." };
    if (state.boat.assembled) return { ok: false, reason: "The skiff is already assembled." };
    var missing = [];
    if (!state.boat.parts.pontoon) missing.push("pontoon plate");
    if (!state.boat.parts.coil) missing.push("starter coil");
    if (!state.boat.parts.fuel) missing.push("fuel kit");
    if (missing.length) return { ok: false, reason: "Still need: " + missing.join(", ") + "." };
    return { ok: true, reason: "" };
  }

  function inspectExtract(state) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    if (state.player.location !== "wreck") return { ok: false, reason: "Leave from Wreck Beach." };
    if (!state.boat.assembled) return { ok: false, reason: "Assemble the skiff first." };
    return { ok: true, reason: "" };
  }

  function inspectEndDay(state) {
    if (state.ended) return { ok: false, reason: "This wipe is already over." };
    return { ok: true, reason: "" };
  }

  function inspectAction(state, action) {
    action = action || {};
    var type = action.type;
    if (type === "move") return inspectMove(state, action.zoneId);
    if (type === "recall") return inspectRecall(state, action.zoneId);
    if (type === "gather") return inspectGather(state, action.resource);
    if (type === "build") return inspectBuild(state, action.structure);
    if (type === "craft") return inspectCraft(state, action.recipeId);
    if (type === "install") return inspectInstall(state, action.kitId, action.roomIndex);
    if (type === "explore") return inspectExplore(state);
    if (type === "assemble") return inspectAssemble(state);
    if (type === "extract") return inspectExtract(state);
    if (type === "endDay") return inspectEndDay(state);
    return { ok: false, reason: "Unknown action." };
  }

  function revealDiscovery(state) {
    if (!state.wipe.discoveryQueue.length) return null;
    var id = state.wipe.discoveryQueue.shift();
    if (state.player.known.indexOf(id) === -1) state.player.known.push(id);
    if (state.player.revealed.indexOf(id) === -1) state.player.revealed.push(id);
    return BLUEPRINTS[id];
  }

  function doMove(state, zoneId) {
    state.player.location = zoneId;
    noteVisit(state, zoneId);
    spendAction(state, "Moved to " + ZONE_META[zoneId].name + ".");
  }

  function doRecall(state, zoneId) {
    zoneId = zoneId || "camp";
    state.player.location = zoneId;
    noteVisit(state, zoneId);
    spendAction(state, "Recalled to " + ZONE_META[zoneId].name + ".");
  }

  function doGather(state, resource) {
    var check = inspectGather(state, resource);
    state.player.inventory[resource] += check.yield;
    spendAction(
      state,
      "Gathered " + check.yield + " " + resource + " at " + ZONE_META[state.player.location].name + "."
    );
  }

  function doBuild(state, structure) {
    var check = inspectBuild(state, structure);
    spendCost(state.player.inventory, check.cost);
    if (structure === "shack") {
      state.base.camp.shape = "1x1";
      state.base.camp.rooms = [{ station: null }];
      spendAction(state, "Dropped a 1×1 on Shore Camp. A bedroll is implied — you can recall home.");
      return;
    }
    if (structure === "expand-1x2") {
      state.base.camp.shape = "1x2";
      state.base.camp.rooms.push({ station: null });
      spendAction(state, "Stretched the shack into a 1×2.");
      return;
    }
    if (structure === "expand-2x2") {
      state.base.camp.shape = "2x2";
      state.base.camp.rooms.push({ station: null }, { station: null });
      spendAction(state, "Squared the compound into a 2×2.");
      return;
    }
    if (structure === "outpost") {
      var loc = state.player.location;
      state.base.outposts[loc] = { rooms: [{ station: null }] };
      spendAction(state, "Planted a 1×1 outpost at " + ZONE_META[loc].name + ".");
    }
  }

  function doCraft(state, recipeId) {
    var check = inspectCraft(state, recipeId);
    var inv = state.player.inventory;
    if (recipeId === "smelt") {
      inv.ore -= 2;
      inv.metal += 1;
      spendAction(state, "Smelted 2 ore into 1 metal.");
      return;
    }
    if (recipeId === "recycle") {
      inv.components -= 2;
      inv.scrap += 1;
      spendAction(state, "Recycled 2 components into 1 scrap.");
      return;
    }
    if (recipeId === "fuel-kit") {
      if (check.path === "processed") {
        var cheap = check.cheap;
        if (inv.scrap >= 1) inv.scrap -= 1;
        else inv.metal -= 1;
        if (!cheap) inv.wood -= 1;
      } else if (inv.components >= 3) {
        inv.components -= 3;
        inv.wood -= 2;
      } else {
        inv.ore -= 3;
        inv.wood -= 2;
      }
      state.boat.parts.fuel = true;
      spendAction(state, "Prepared a fuel kit for the skiff.");
      return;
    }
    var bp = BLUEPRINTS[recipeId];
    spendCost(inv, bp.cost);
    if (bp.kind === "tool") {
      state.player.hatchet = true;
      spendAction(state, "Crafted a Stone Hatchet.");
      return;
    }
    state.player.kits.push(recipeId);
    spendAction(state, "Crafted a " + bp.name + " kit.");
  }

  function doInstall(state, kitId, roomIndex) {
    var check = inspectInstall(state, kitId, roomIndex);
    var loc = state.player.location;
    var rooms = siteRooms(state, loc);
    var kit = check.kit;
    var bp = BLUEPRINTS[kit];
    rooms[check.roomIndex].station = bp.station;
    var idx = state.player.kits.indexOf(kit);
    if (idx !== -1) state.player.kits.splice(idx, 1);
    spendAction(
      state,
      "Installed " + bp.name + " in room " + (check.roomIndex + 1) + " at " + ZONE_META[loc].name + "."
    );
  }

  function doExplore(state) {
    var loc = state.player.location;
    if (loc === "wreck") {
      state.boat.seen = true;
      noteVisit(state, loc);
      spendAction(
        state,
        "Identified the extraction skiff. Missing: pontoon plate (Train Yard), starter coil (Military Tunnels), and a fuel kit you prepare at home."
      );
      return;
    }
    var monumentId = state.wipe.zones[loc].monument;
    var monument = MONUMENTS[monumentId];
    var record = state.monuments[monumentId];
    record.visits += 1;
    var bits = ["Searched " + monument.name + "."];
    if (record.visits === 1) {
      state.boat.parts[monument.part] = true;
      bits.push("Found the " + monument.partName + ".");
    }
    var found = revealDiscovery(state);
    if (found) bits.push("Unlocked " + found.name + ".");
    else if (record.visits > 1) {
      var inv = state.player.inventory;
      if (resourceTotal(inv) < carryCap(state)) {
        if (monumentId === "train-yard") {
          inv.components += 1;
          bits.push("Picked 1 extra component.");
        } else {
          inv.ore += 1;
          bits.push("Picked 1 extra ore.");
        }
      }
    }
    spendAction(state, bits.join(" "));
  }

  function portraitLines(state) {
    var rooms = state.base.camp.rooms;
    var shape = state.base.camp.shape;
    function cell(i) {
      var room = rooms[i];
      if (!room) return "    ";
      var g = room.station ? STATION_GLYPH[room.station] || "?" : "·";
      return " " + g + "  ";
    }
    function row(a, b) {
      if (b == null) return "+" + "----+" + "\n|" + cell(a) + "|\n+----+";
      return "+----+----+\n|" + cell(a) + "|" + cell(b) + "|\n+----+----+";
    }
    var lines;
    if (shape === "none") lines = ["[ empty beach ]"];
    else if (shape === "1x1") lines = row(0).split("\n");
    else if (shape === "1x2") lines = row(0, 1).split("\n");
    else {
      lines = (row(0, 1) + "\n" + row(2, 3)).split("\n");
    }
    var outposts = Object.keys(state.base.outposts);
    if (outposts.length) {
      lines.push(
        "Outposts: " +
          outposts
            .map(function (id) {
              var st = state.base.outposts[id].rooms
                .map(function (room) {
                  return room.station ? STATION_LABEL[room.station] : "empty";
                })
                .join("/");
              return ZONE_META[id].name + " (" + st + ")";
            })
            .join("; ")
      );
    }
    return lines;
  }

  function getSummary(state) {
    var stations = [];
    state.base.camp.rooms.forEach(function (room) {
      if (room.station) stations.push(STATION_LABEL[room.station]);
    });
    Object.keys(state.base.outposts).forEach(function (id) {
      state.base.outposts[id].rooms.forEach(function (room) {
        if (room.station) stations.push(STATION_LABEL[room.station] + " @ " + ZONE_META[id].name);
      });
    });
    return {
      seed: state.seed,
      layoutId: state.wipe.layoutId,
      layoutName: state.wipe.layoutName,
      hook: state.wipe.hook,
      contrast: state.wipe.contrast,
      days: state.day,
      actionsTaken: state.actionsTaken,
      shape: state.base.camp.shape,
      stations: stations,
      portrait: portraitLines(state).join("\n"),
      route: state.route.map(function (id) {
        return ZONE_META[id].name;
      }),
      discoveries: state.player.revealed.map(function (id) {
        return BLUEPRINTS[id].name;
      }),
      parts: clone(state.boat.parts),
      ending: "Extracted on the repaired skiff. The island resets; this portrait stays.",
    };
  }

  function doAssemble(state) {
    state.boat.assembled = true;
    spendAction(state, "Bolted the pontoon, seated the coil, and poured the fuel. The skiff will run.");
  }

  function doExtract(state) {
    state.ended = getSummary(state);
    state.ended.ending =
      "You chose to leave on day " + state.day + ". The island goes quiet. Memory keeps the base you built.";
    pushLog(state, "Extracted. " + state.wipe.contrast);
  }

  function applyAction(state, action) {
    if (!state || typeof state !== "object") throw new Error("Missing game state.");
    action = action || {};
    var next = clone(state);
    var check = inspectAction(next, action);
    if (!check.ok) throw new Error(check.reason || "Illegal action.");
    if (action.type === "move") doMove(next, action.zoneId);
    else if (action.type === "recall") doRecall(next, action.zoneId);
    else if (action.type === "gather") doGather(next, action.resource);
    else if (action.type === "build") doBuild(next, action.structure);
    else if (action.type === "craft") doCraft(next, action.recipeId);
    else if (action.type === "install") doInstall(next, action.kitId, action.roomIndex);
    else if (action.type === "explore") doExplore(next);
    else if (action.type === "assemble") doAssemble(next);
    else if (action.type === "extract") doExtract(next);
    else if (action.type === "endDay") nextDay(next, "Rested.");
    return next;
  }

  function uniqueRoute(route) {
    var seen = Object.create(null);
    var out = [];
    route.forEach(function (id) {
      if (!seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    });
    return out;
  }

  function zoneView(state, id) {
    var zone = state.wipe.zones[id];
    var monument = zone.monument ? MONUMENTS[zone.monument] : null;
    return {
      id: id,
      name: zone.name,
      terrain: zone.terrain,
      col: zone.col,
      row: zone.row,
      nodes: zone.nodes,
      monument: monument
        ? {
            id: monument.id,
            name: monument.name,
            visits: state.monuments[monument.id].visits,
            partName: monument.partName,
          }
        : null,
      isHere: state.player.location === id,
      claimed: isClaimed(state, id),
      buildable: zone.buildable,
      move: inspectMove(state, id),
      recall: inspectRecall(state, id),
    };
  }

  function recipeView(state, id) {
    var bp = BLUEPRINTS[id];
    return {
      id: id,
      name: bp ? bp.name : id,
      icon: bp ? bp.icon : "mark",
      summary: bp ? bp.summary : "",
      known: id === "smelt" || id === "recycle" || id === "fuel-kit" ? true : knownHas(state, id),
      craft: inspectCraft(state, id),
      cost: bp ? bp.cost : null,
    };
  }

  function getView(state) {
    var loc = state.player.location;
    var zone = state.wipe.zones[loc];
    return {
      version: state.version,
      seed: state.seed,
      day: state.day,
      actionsLeft: state.actionsLeft,
      actionsPerDay: ACTIONS_PER_DAY,
      actionsTaken: state.actionsTaken,
      ended: state.ended,
      hook: state.wipe.hook,
      layoutId: state.wipe.layoutId,
      layoutName: state.wipe.layoutName,
      contrast: state.wipe.contrast,
      objective: state.wipe.objective,
      location: loc,
      locationName: zone.name,
      inventory: clone(state.player.inventory),
      cap: carryCap(state),
      carried: resourceTotal(state.player.inventory),
      kits: state.player.kits.slice(),
      hatchet: state.player.hatchet,
      known: state.player.known.slice(),
      revealed: state.player.revealed.map(function (id) {
        return { id: id, name: BLUEPRINTS[id].name, icon: BLUEPRINTS[id].icon };
      }),
      boat: clone(state.boat),
      base: clone(state.base),
      portrait: portraitLines(state).join("\n"),
      route: state.route.slice(),
      uniqueRoute: uniqueRoute(state.route),
      log: state.log.slice(),
      map: Object.keys(ZONE_META).map(function (id) {
        return zoneView(state, id);
      }),
      monuments: Object.keys(MONUMENTS).map(function (id) {
        var seat = state.wipe.monuments[id];
        return {
          id: id,
          name: MONUMENTS[id].name,
          zoneId: seat,
          zoneName: ZONE_META[seat].name,
          visits: state.monuments[id].visits,
          partName: MONUMENTS[id].partName,
          partHave: state.boat.parts[MONUMENTS[id].part],
        };
      }),
      actions: {
        gather: inspectGather(state, null),
        recallCamp: inspectRecall(state, "camp"),
        explore: inspectExplore(state),
        assemble: inspectAssemble(state),
        extract: inspectExtract(state),
        endDay: inspectEndDay(state),
        build: {
          shack: inspectBuild(state, "shack"),
          "expand-1x2": inspectBuild(state, "expand-1x2"),
          "expand-2x2": inspectBuild(state, "expand-2x2"),
          outpost: inspectBuild(state, "outpost"),
        },
        craft: ["smelt", "recycle", "fuel-kit"]
          .concat(STARTER_KNOWN)
          .concat(DISCOVERY_POOL)
          .map(function (id) {
            return recipeView(state, id);
          }),
        install: inspectInstall(state, null, null),
      },
    };
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function parse(raw) {
    var data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") throw new Error("Saved wipe is empty.");
    if (data.version !== STORAGE_VERSION) throw new Error("Saved wipe version is not supported.");
    if (!data.wipe || !data.wipe.layoutId) throw new Error("Saved wipe is missing the island.");
    if (!data.player || typeof data.player !== "object") throw new Error("Saved survivor is missing.");
    data.version = VERSION;
    data.seed = data.seed != null ? String(data.seed) : data.wipe.seed;
    data.log = Array.isArray(data.log) ? data.log.map(String) : [];
    data.route = Array.isArray(data.route) ? data.route.map(String) : ["camp"];
    data.day = Number(data.day) || 1;
    data.actionsLeft = Number(data.actionsLeft);
    if (!Number.isFinite(data.actionsLeft)) data.actionsLeft = ACTIONS_PER_DAY;
    data.actionsTaken = Number(data.actionsTaken) || 0;
    data.ended = data.ended || null;
    return data;
  }

  function demoSeeds() {
    var found = {};
    for (var i = 0; i < 8000 && Object.keys(found).length < LAYOUTS.length; i++) {
      var seed = "wipe-" + i;
      var wipe = generateWipe(seed);
      if (!found[wipe.layoutId]) found[wipe.layoutId] = seed;
    }
    return found;
  }

  return {
    VERSION: VERSION,
    ACTIONS_PER_DAY: ACTIONS_PER_DAY,
    RESOURCES: RESOURCES,
    BLUEPRINTS: BLUEPRINTS,
    DISCOVERY_POOL: DISCOVERY_POOL,
    LAYOUTS: LAYOUTS,
    MONUMENTS: MONUMENTS,
    ZONE_META: ZONE_META,
    ADJACENT: ADJACENT,
    generateWipe: generateWipe,
    createGame: createGame,
    applyAction: applyAction,
    inspectAction: inspectAction,
    getView: getView,
    getSummary: getSummary,
    portraitLines: portraitLines,
    serialize: serialize,
    parse: parse,
    clone: clone,
    layoutById: layoutById,
    demoSeeds: demoSeeds,
    resourceTotal: resourceTotal,
    carryCap: carryCap,
    fuelCost: fuelCost,
  };
});
