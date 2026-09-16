/**
 * Wipe Table — hostile-island map prototype.
 * Pure state module. No DOM. Safe in the browser or via require().
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WipeMapGame = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RESOURCES = ["wood", "stone", "metal", "sulfur", "cloth", "food", "scrap"];
  var CARRY_LIMIT = 5;
  var ACTIONS_PER_TURN = 2;
  var HAND_LIMIT = 3;
  var WOUNDS_TO_DOWN = 3;
  var SCRAP_TO_WIN = 12;
  var MAX_ROUNDS = 10;
  var DEATHS_TO_ELIMINATE = 3;
  var VERSION = 1;
  var STORAGE_KEY = "wipe-table.map.v1";

  var RESOURCE_LABELS = {
    wood: "Wood",
    stone: "Stone",
    metal: "Metal",
    sulfur: "Sulfur",
    cloth: "Cloth",
    food: "Food",
    scrap: "Scrap",
  };

  var MAP_NODES = [
    { id: "north-beach", name: "North Beach", type: "beach", spawn: 0, x: 500, y: 72, stock: { food: 1, wood: 1 } },
    { id: "wood-grove", name: "Wood Grove", type: "resource", x: 318, y: 158, stock: { wood: 4, stone: 1 } },
    { id: "scrap-heap", name: "Scrap Heap", type: "resource", x: 682, y: 158, stock: { metal: 2, cloth: 2, scrap: 1 } },
    { id: "west-clearing", name: "West Clearing", type: "clearing", x: 168, y: 278, stock: {} },
    { id: "outpost", name: "Outpost", type: "monument", monument: "outpost", wb: 1, x: 500, y: 252, stock: { cloth: 1 } },
    { id: "east-clearing", name: "East Clearing", type: "clearing", x: 832, y: 278, stock: {} },
    { id: "bandit-camp", name: "Bandit Camp", type: "monument", monument: "bandit", wb: 0, scrap: 1, x: 188, y: 418, stock: {} },
    { id: "mid-clearing", name: "Ridge Clearing", type: "clearing", x: 500, y: 398, stock: {} },
    { id: "train-yard", name: "Train Yard", type: "monument", monument: "train", wb: 0, scrap: 1, x: 812, y: 418, stock: {} },
    { id: "south-beach", name: "South Beach", type: "beach", spawn: 1, x: 268, y: 568, stock: { food: 1, wood: 1 } },
    { id: "airfield", name: "Airfield", type: "monument", monument: "airfield", wb: 2, x: 500, y: 548, stock: { metal: 1 } },
    { id: "stone-quarry", name: "Stone Quarry", type: "resource", x: 748, y: 568, stock: { stone: 4 } },
    { id: "sulfur-pit", name: "Sulfur Pit", type: "resource", x: 678, y: 698, stock: { sulfur: 3 } },
    { id: "launch", name: "Launch Site", type: "monument", monument: "launch", wb: 3, scrap: 1, x: 412, y: 708, stock: {} },
  ];

  var MAP_EDGES = [
    ["north-beach", "wood-grove"],
    ["north-beach", "scrap-heap"],
    ["wood-grove", "west-clearing"],
    ["wood-grove", "outpost"],
    ["scrap-heap", "outpost"],
    ["scrap-heap", "east-clearing"],
    ["west-clearing", "outpost"],
    ["west-clearing", "bandit-camp"],
    ["outpost", "east-clearing"],
    ["outpost", "mid-clearing"],
    ["east-clearing", "train-yard"],
    ["bandit-camp", "south-beach"],
    ["bandit-camp", "mid-clearing"],
    ["mid-clearing", "train-yard"],
    ["mid-clearing", "airfield"],
    ["train-yard", "stone-quarry"],
    ["south-beach", "airfield"],
    ["airfield", "stone-quarry"],
    ["airfield", "launch"],
    ["stone-quarry", "sulfur-pit"],
    ["launch", "sulfur-pit"],
    ["south-beach", "west-clearing"],
    ["east-clearing", "airfield"],
  ];

  var RECIPES = [
    { id: "bow", name: "Bow", kind: "gear", wb: 1, cost: { wood: 2, cloth: 1 }, text: "+1 attack." },
    { id: "wooden-door", name: "Wooden Door", kind: "door", wb: 1, cost: { wood: 2 }, text: "+1 defense on your base node." },
    { id: "revolver", name: "Revolver", kind: "gear", wb: 2, cost: { metal: 2, sulfur: 1 }, text: "+2 attack." },
    { id: "metal-door", name: "Metal Door", kind: "door", wb: 2, cost: { metal: 2 }, text: "+1 defense on your base node." },
    { id: "armor", name: "Armor", kind: "gear", wb: 3, cost: { metal: 2, cloth: 1 }, text: "+1 attack and +1 defense." },
    { id: "timed-charge", name: "Timed Charge", kind: "charge", wb: 3, cost: { sulfur: 2, metal: 1 }, text: "+3 attack once, then consumed." },
  ];

  var CARD_DEFS = [
    { id: "loot-wood", name: "Hidden Stash", type: "loot", text: "Gain 2 wood.", gain: { wood: 2 } },
    { id: "loot-cloth", name: "Rag Pile", type: "loot", text: "Gain 2 cloth.", gain: { cloth: 2 } },
    { id: "loot-stone", name: "Rock Cache", type: "loot", text: "Gain 2 stone.", gain: { stone: 2 } },
    { id: "loot-metal", name: "Pipe Bundle", type: "loot", text: "Gain 2 metal.", gain: { metal: 2 } },
    { id: "loot-sulfur", name: "Gunpowder Jar", type: "loot", text: "Gain 1 sulfur.", gain: { sulfur: 1 } },
    { id: "loot-food", name: "Can Pile", type: "loot", text: "Gain 2 food.", gain: { food: 2 } },
    { id: "loot-scrap", name: "Ticket Stub", type: "loot", text: "Gain 1 scrap.", gain: { scrap: 1 } },
    { id: "loot-mix", name: "Recycler Bits", type: "loot", text: "Gain 1 metal and 1 cloth.", gain: { metal: 1, cloth: 1 } },
    { id: "loot-beach", name: "Shore Crate", type: "loot", text: "Gain 1 wood and 1 food.", gain: { wood: 1, food: 1 } },
    { id: "bp-notes", name: "Workbench Notes", type: "blueprint", text: "Your next craft costs 1 fewer resource.", discount: 1 },
    { id: "bp-schematic", name: "Stolen Schematic", type: "blueprint", text: "Your next craft costs 1 fewer resource.", discount: 1 },
    { id: "bp-kit", name: "Engineer Kit", type: "blueprint", text: "Your next craft costs 1 fewer resource.", discount: 1 },
    { id: "ev-heli", name: "Heli Light", type: "event", text: "Gain 1 sulfur, then risk a wound (1–3 on a d6).", gain: { sulfur: 1 }, woundRisk: true },
    { id: "ev-cargo", name: "Cargo Light", type: "event", text: "Gain 1 sulfur, then risk a wound (1–3 on a d6).", gain: { sulfur: 1 }, woundRisk: true },
    { id: "ev-patrol", name: "Patrol Sweep", type: "event", text: "Wound risk (1–3 on a d6). No loot.", woundRisk: true },
    { id: "ev-drop", name: "Airdrop Rumble", type: "event", text: "Gain 1 scrap, then risk a wound (1–3 on a d6).", gain: { scrap: 1 }, woundRisk: true },
  ];

  var PLAYER_NAMES = ["Ash", "Tide"];
  var PLAYER_COLORS = ["#d4782e", "#5b9ea8"];

  var adjacency = null;
  var nodeIndex = null;

  function ensureIndexes() {
    if (nodeIndex && adjacency) return;
    nodeIndex = Object.create(null);
    MAP_NODES.forEach(function (node) {
      nodeIndex[node.id] = node;
    });
    adjacency = Object.create(null);
    MAP_NODES.forEach(function (node) {
      adjacency[node.id] = [];
    });
    MAP_EDGES.forEach(function (edge) {
      adjacency[edge[0]].push(edge[1]);
      adjacency[edge[1]].push(edge[0]);
    });
  }

  function getNode(id) {
    ensureIndexes();
    var node = nodeIndex[id];
    if (!node) throw new Error("Unknown node: " + id);
    return node;
  }

  function neighbors(id) {
    ensureIndexes();
    return (adjacency[id] || []).slice();
  }

  function emptyBag() {
    var bag = {};
    RESOURCES.forEach(function (r) {
      bag[r] = 0;
    });
    return bag;
  }

  function copyBag(bag) {
    var out = emptyBag();
    RESOURCES.forEach(function (r) {
      out[r] = Math.max(0, Number(bag && bag[r]) || 0);
    });
    return out;
  }

  function bagTotal(bag) {
    var n = 0;
    RESOURCES.forEach(function (r) {
      n += Math.max(0, Number(bag && bag[r]) || 0);
    });
    return n;
  }

  function bagHasAnything(bag) {
    return bagTotal(bag) > 0;
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hashSeed(text) {
    var str = String(text || "wipe-map");
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function nextRandom(state) {
    var a = (state.rngState + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    state.rngState = a >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function rollD6(state, injected) {
    if (typeof injected === "number" && injected >= 1 && injected <= 6) return injected;
    return 1 + Math.floor(nextRandom(state) * 6);
  }

  function shuffleInPlace(state, list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(nextRandom(state) * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function log(state, message) {
    state.log.unshift({ turn: state.turnsCompleted + 1, round: state.round, text: message });
    if (state.log.length > 80) state.log.length = 80;
  }

  function currentPlayer(state) {
    return state.players[state.currentPlayer];
  }

  function otherPlayer(state, player) {
    return state.players[player.id === 0 ? 1 : 0];
  }

  function occupantOn(state, nodeId, exceptId) {
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      if (p.node === nodeId && p.id !== exceptId) return p;
    }
    return null;
  }

  function playerCombined(player) {
    var bag = emptyBag();
    RESOURCES.forEach(function (r) {
      bag[r] = (player.carry[r] || 0) + (player.storage[r] || 0);
    });
    return bag;
  }

  function canPayFromBags(player, cost) {
    var have = playerCombined(player);
    for (var i = 0; i < RESOURCES.length; i++) {
      var r = RESOURCES[i];
      if ((cost[r] || 0) > have[r]) return false;
    }
    return true;
  }

  function payFromBags(player, cost, preferStorage) {
    var remaining = copyBag(cost);
    var order = preferStorage ? [player.storage, player.carry] : [player.carry, player.storage];
    order.forEach(function (bag) {
      RESOURCES.forEach(function (r) {
        var need = remaining[r];
        if (!need) return;
        var take = Math.min(need, bag[r] || 0);
        bag[r] -= take;
        remaining[r] -= take;
      });
    });
    if (bagTotal(remaining) > 0) {
      throw new Error("Not enough resources.");
    }
  }

  function addGain(state, player, gain) {
    var leftover = copyBag(gain);
    RESOURCES.forEach(function (r) {
      var amount = leftover[r] || 0;
      leftover[r] = 0;
      for (var n = 0; n < amount; n++) {
        if (bagTotal(player.carry) < CARRY_LIMIT) {
          player.carry[r] += 1;
          if (r === "scrap") player.scrap += 1;
        } else if (player.baseNode) {
          player.storage[r] += 1;
          if (r === "scrap") player.scrap += 1;
        } else {
          leftover[r] += 1;
        }
      }
    });
    if (bagTotal(leftover) > 0) {
      addStock(state, player.node, leftover);
      log(state, player.name + " dropped extra loot on " + getNode(player.node).name + ".");
    }
  }

  function addStock(state, nodeId, bag) {
    var stock = state.stocks[nodeId] || emptyBag();
    RESOURCES.forEach(function (r) {
      stock[r] = (stock[r] || 0) + (bag[r] || 0);
    });
    state.stocks[nodeId] = stock;
  }

  function takeStock(state, nodeId, bag) {
    var stock = state.stocks[nodeId] || emptyBag();
    RESOURCES.forEach(function (r) {
      var need = bag[r] || 0;
      if (need > (stock[r] || 0)) throw new Error("That node does not have those resources.");
      stock[r] -= need;
    });
    state.stocks[nodeId] = stock;
  }

  function recipeById(id) {
    for (var i = 0; i < RECIPES.length; i++) {
      if (RECIPES[i].id === id) return RECIPES[i];
    }
    return null;
  }

  function cardById(id) {
    for (var i = 0; i < CARD_DEFS.length; i++) {
      if (CARD_DEFS[i].id === id) return CARD_DEFS[i];
    }
    return null;
  }

  function discountedCost(player, cost) {
    var next = copyBag(cost);
    var remain = player.craftDiscount || 0;
    RESOURCES.forEach(function (r) {
      if (!remain) return;
      var cut = Math.min(remain, next[r] || 0);
      next[r] -= cut;
      remain -= cut;
    });
    return next;
  }

  function formatBag(bag) {
    var parts = [];
    RESOURCES.forEach(function (r) {
      if (bag[r]) parts.push(bag[r] + " " + RESOURCE_LABELS[r].toLowerCase());
    });
    return parts.length ? parts.join(", ") : "nothing";
  }

  function spawnNodeFor(player) {
    if (player.baseNode) return player.baseNode;
    return player.id === 0 ? "north-beach" : "south-beach";
  }

  function applyWound(state, player, source) {
    player.wounds += 1;
    log(state, player.name + " takes a wound" + (source ? " (" + source + ")" : "") + " — " + player.wounds + "/" + WOUNDS_TO_DOWN + ".");
    if (player.wounds >= WOUNDS_TO_DOWN) {
      downPlayer(state, player);
      return true;
    }
    return false;
  }

  function downPlayer(state, player) {
    var nodeId = player.node;
    var dropped = copyBag(player.carry);
    if (bagHasAnything(dropped)) {
      addStock(state, nodeId, dropped);
      player.carry = emptyBag();
      log(state, player.name + " is downed and drops " + formatBag(dropped) + " on " + getNode(nodeId).name + ".");
    } else {
      log(state, player.name + " is downed.");
    }
    player.wounds = 0;
    player.deaths += 1;
    player.node = spawnNodeFor(player);
    log(state, player.name + " respawns at " + getNode(player.node).name + ".");
    checkEliminationWin(state);
  }

  function stealResources(state, winner, loser, count) {
    var taken = emptyBag();
    var left = count;
    function drain(bag) {
      RESOURCES.forEach(function (r) {
        if (r === "scrap") return;
        while (left > 0 && bag[r] > 0) {
          bag[r] -= 1;
          taken[r] += 1;
          left -= 1;
        }
      });
      while (left > 0 && bag.scrap > 0) {
        bag.scrap -= 1;
        taken.scrap += 1;
        left -= 1;
      }
    }
    drain(loser.carry);
    drain(loser.storage);
    if (bagTotal(taken) === 0) {
      winner.scrap += 1;
      if (bagTotal(winner.carry) < CARRY_LIMIT) winner.carry.scrap += 1;
      else if (winner.baseNode) winner.storage.scrap += 1;
      log(state, winner.name + " takes 1 scrap token because " + loser.name + " had nothing.");
      return { scrapToken: true, bag: emptyBag() };
    }
    addGain(state, winner, taken);
    log(state, winner.name + " loots " + formatBag(taken) + " from " + loser.name + ".");
    return { scrapToken: false, bag: taken };
  }

  function attackBonus(player) {
    var bonus = 0;
    var parts = ["1"];
    if (player.gear.bow) {
      bonus += 1;
      parts.push("Bow +1");
    }
    if (player.gear.revolver) {
      bonus += 2;
      parts.push("Revolver +2");
    }
    if (player.gear.armor) {
      bonus += 1;
      parts.push("Armor +1");
    }
    return { bonus: bonus, parts: parts, base: 1 };
  }

  function defenseBonus(player, nodeId) {
    var bonus = 0;
    var parts = ["1"];
    if (player.gear.armor) {
      bonus += 1;
      parts.push("Armor +1");
    }
    var onBase = player.baseNode && player.baseNode === nodeId;
    var hasDoor = player.doors.wooden || player.doors.metal;
    if (onBase && hasDoor) {
      bonus += 1;
      parts.push((player.doors.metal ? "Metal door" : "Wooden door") + " +1");
    }
    return { bonus: bonus, parts: parts, base: 1, door: onBase && hasDoor };
  }

  function resolveCombat(state, attacker, defender, dice) {
    dice = dice || {};
    var atk = attackBonus(attacker);
    var def = defenseBonus(defender, attacker.node);
    var chargeUsed = false;
    if (attacker.gear.timedCharge > 0) {
      atk.bonus += 3;
      atk.parts.push("Timed Charge +3");
      attacker.gear.timedCharge -= 1;
      chargeUsed = true;
    }
    var attackDie = rollD6(state, dice.attack);
    var defenseDie = rollD6(state, dice.defense);
    var attackTotal = atk.base + atk.bonus + attackDie;
    var defenseTotal = def.base + def.bonus + defenseDie;
    var winner = null;
    var resultText;
    if (attackTotal > defenseTotal) {
      winner = attacker.id;
      resultText = attacker.name + " wins the fight.";
    } else if (defenseTotal > attackTotal) {
      winner = defender.id;
      resultText = defender.name + " holds the node.";
    } else {
      resultText = "Clash — neither side gives ground.";
    }
    var combat = {
      node: attacker.node,
      attackerId: attacker.id,
      defenderId: defender.id,
      attack: {
        base: atk.base,
        gear: atk.bonus,
        parts: atk.parts,
        die: attackDie,
        total: attackTotal,
        chargeUsed: chargeUsed,
      },
      defense: {
        base: def.base,
        gear: def.bonus,
        parts: def.parts,
        die: defenseDie,
        total: defenseTotal,
        door: def.door,
      },
      winner: winner,
      text: resultText,
      loot: null,
      wound: false,
      downed: false,
    };
    log(
      state,
      "Fight on " +
        getNode(attacker.node).name +
        ": " +
        attacker.name +
        " " +
        attackTotal +
        " (" +
        atk.parts.join(" + ") +
        " + d6 " +
        attackDie +
        ") vs " +
        defender.name +
        " " +
        defenseTotal +
        " (" +
        def.parts.join(" + ") +
        " + d6 " +
        defenseDie +
        ")."
    );
    if (winner != null) {
      var winP = winner === attacker.id ? attacker : defender;
      var loseP = winner === attacker.id ? defender : attacker;
      combat.loot = stealResources(state, winP, loseP, 2);
      combat.wound = true;
      combat.downed = applyWound(state, loseP, "fight");
    } else {
      log(state, resultText);
    }
    state.lastCombat = combat;
    checkScrapWin(state);
    return combat;
  }

  function checkScrapWin(state) {
    if (state.phase === "over") return;
    var leaders = state.players.filter(function (p) {
      return p.scrap >= SCRAP_TO_WIN;
    });
    if (!leaders.length) return;
    leaders.sort(function (a, b) {
      return b.scrap - a.scrap || b.workbench - a.workbench || a.id - b.id;
    });
    endGame(state, leaders[0].id, leaders[0].name + " hits " + leaders[0].scrap + " scrap.");
  }

  function checkEliminationWin(state) {
    if (state.phase === "over") return;
    state.players.forEach(function (p) {
      if (p.deaths >= DEATHS_TO_ELIMINATE) {
        var foe = otherPlayer(state, p);
        if (foe.baseNode) {
          endGame(state, foe.id, foe.name + " is the last standing base after " + p.name + " is eliminated.");
        }
      }
    });
  }

  function checkRoundWin(state) {
    if (state.phase === "over") return;
    if (state.round <= MAX_ROUNDS) return;
    var a = state.players[0];
    var b = state.players[1];
    if (a.scrap !== b.scrap) {
      var winner = a.scrap > b.scrap ? a : b;
      endGame(state, winner.id, "Ten rounds. " + winner.name + " has the most scrap (" + winner.scrap + ").");
      return;
    }
    var aScore = (a.baseNode ? 10 : 0) + a.workbench;
    var bScore = (b.baseNode ? 10 : 0) + b.workbench;
    if (aScore !== bScore) {
      var hold = aScore > bScore ? a : b;
      endGame(state, hold.id, "Ten rounds. Scrap tied at " + a.scrap + "; " + hold.name + " has the stronger hold.");
      return;
    }
    endGame(state, 0, "Ten rounds. Scrap tied at " + a.scrap + "; " + a.name + " wins the table-side tie.");
  }

  function endGame(state, winnerId, reason) {
    if (state.phase === "over") return;
    state.phase = "over";
    state.winner = winnerId;
    state.winReason = reason;
    state.actionsLeft = 0;
    log(state, "Wipe over. " + reason);
  }

  function restock(state) {
    MAP_NODES.forEach(function (node) {
      var stock = state.stocks[node.id];
      if (!stock) return;
      if (node.type !== "resource" && node.type !== "beach") return;
      var primary = "wood";
      if (node.stock.stone) primary = "stone";
      else if (node.stock.sulfur) primary = "sulfur";
      else if (node.stock.metal) primary = "metal";
      else if (node.stock.food) primary = "food";
      else if (node.stock.wood) primary = "wood";
      if (bagTotal(stock) < 4) stock[primary] = (stock[primary] || 0) + 1;
    });
  }

  function maybeEndTurn(state) {
    if (state.phase === "over") return;
    if (state.actionsLeft > 0) return;
    finishTurn(state);
  }

  function finishTurn(state) {
    if (state.phase === "over") return;
    state.turnsCompleted += 1;
    state.drewCardThisTurn = false;
    var next = state.currentPlayer === 0 ? 1 : 0;
    if (next === 0) {
      state.round += 1;
      restock(state);
      checkRoundWin(state);
      if (state.phase === "over") return;
    }
    state.currentPlayer = next;
    state.actionsLeft = ACTIONS_PER_TURN;
    state.pendingHandoff = true;
    log(state, state.players[next].name + "'s turn — round " + state.round + ".");
  }

  function spendAction(state) {
    if (state.phase === "over") throw new Error("The wipe is over.");
    if (state.actionsLeft <= 0) throw new Error("No actions left. End the turn.");
    state.actionsLeft -= 1;
  }

  function assertTurn(state, playerId) {
    if (playerId != null && playerId !== state.currentPlayer) {
      throw new Error("It is not that player's turn.");
    }
  }

  function autoScavengeTake(state, player, maxTake) {
    var stock = state.stocks[player.node] || emptyBag();
    var take = emptyBag();
    var room = CARRY_LIMIT - bagTotal(player.carry);
    var left = Math.min(maxTake, room);
    while (left > 0 && bagHasAnything(stock)) {
      var progressed = false;
      RESOURCES.forEach(function (r) {
        if (left <= 0) return;
        if ((stock[r] || 0) > 0) {
          take[r] += 1;
          stock[r] -= 1;
          left -= 1;
          progressed = true;
        }
      });
      if (!progressed) break;
    }
    state.stocks[player.node] = stock;
    return take;
  }

  function visitPaymentOptions(player) {
    var have = playerCombined(player);
    var options = [];
    if (have.food >= 1) options.push({ food: 1 });
    if (bagTotal(have) >= 2) {
      var two = emptyBag();
      var left = 2;
      RESOURCES.forEach(function (r) {
        while (left > 0 && have[r] > two[r]) {
          if (r === "food" && have.food === 1 && bagTotal(have) === 1) break;
          two[r] += 1;
          left -= 1;
        }
      });
      if (bagTotal(two) === 2) options.push(two);
    }
    return options;
  }

  function defaultVisitPay(player) {
    var have = playerCombined(player);
    if (have.food >= 1) return { food: 1 };
    var take = emptyBag();
    var left = 2;
    RESOURCES.forEach(function (r) {
      while (left > 0 && have[r] > 0) {
        take[r] += 1;
        have[r] -= 1;
        left -= 1;
      }
    });
    if (bagTotal(take) < 2) throw new Error("Visit costs 1 food or 2 resources.");
    return take;
  }

  function drawFromDeck(state) {
    if (!state.deck.length) {
      if (!state.discard.length) throw new Error("The deck is empty.");
      state.deck = shuffleInPlace(state, state.discard.splice(0, state.discard.length));
      log(state, "The discard is shuffled back into the deck.");
    }
    return state.deck.pop();
  }

  function createPlayer(id, seedCarry) {
    return {
      id: id,
      name: PLAYER_NAMES[id],
      color: PLAYER_COLORS[id],
      node: id === 0 ? "north-beach" : "south-beach",
      workbench: 0,
      carry: seedCarry,
      storage: emptyBag(),
      scrap: 0,
      wounds: 0,
      deaths: 0,
      baseNode: null,
      gear: { bow: false, revolver: false, armor: false, timedCharge: 0 },
      doors: { wooden: false, metal: false },
      hand: [],
      visited: {},
      craftDiscount: 0,
    };
  }

  function createGame(options) {
    options = options || {};
    ensureIndexes();
    var seed = options.seed == null || options.seed === "" ? String(Date.now()) : String(options.seed);
    var stocks = {};
    MAP_NODES.forEach(function (node) {
      stocks[node.id] = copyBag(node.stock);
    });
    var p1Carry = emptyBag();
    p1Carry.wood = 1;
    var p2Carry = emptyBag();
    p2Carry.wood = 1;
    var state = {
      version: VERSION,
      seed: seed,
      rngState: options.rngState != null ? options.rngState >>> 0 : hashSeed(seed),
      phase: "playing",
      winner: null,
      winReason: "",
      currentPlayer: 0,
      actionsLeft: ACTIONS_PER_TURN,
      round: 1,
      turnsCompleted: 0,
      drewCardThisTurn: false,
      pendingHandoff: false,
      players: [createPlayer(0, p1Carry), createPlayer(1, p2Carry)],
      stocks: stocks,
      deck: CARD_DEFS.map(function (c) {
        return c.id;
      }),
      discard: [],
      log: [],
      lastCombat: null,
    };
    shuffleInPlace(state, state.deck);
    log(state, "Ash and Tide wash up. Two actions each. First to 12 scrap, or most scrap after 10 rounds.");
    log(state, "Ash's turn — round 1.");
    return state;
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function deserialize(raw) {
    var state = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!state || state.version !== VERSION || !Array.isArray(state.players) || state.players.length !== 2) {
      throw new Error("Saved map game is from another build.");
    }
    return state;
  }

  function legalActions(state) {
    var list = [];
    if (state.phase !== "playing") return list;
    var player = currentPlayer(state);
    if (state.actionsLeft <= 0) {
      list.push({ type: "end" });
      return list;
    }
    neighbors(player.node).forEach(function (id) {
      list.push({ type: "move", to: id });
    });
    if (bagHasAnything(state.stocks[player.node]) && bagTotal(player.carry) < CARRY_LIMIT) {
      list.push({ type: "scavenge" });
    }
    if (player.baseNode && player.node === player.baseNode && bagHasAnything(player.carry)) {
      list.push({ type: "deposit" });
    }
    var node = getNode(player.node);
    if (
      node.type === "clearing" &&
      !player.baseNode &&
      !state.players.some(function (p) {
        return p.baseNode === node.id;
      }) &&
      canPayFromBags(player, { wood: 2, stone: 1 })
    ) {
      list.push({ type: "build" });
    }
    if (player.baseNode && player.node === player.baseNode) {
      RECIPES.forEach(function (recipe) {
        if (player.workbench < recipe.wb) return;
        if (recipe.id === "bow" && player.gear.bow) return;
        if (recipe.id === "revolver" && player.gear.revolver) return;
        if (recipe.id === "armor" && player.gear.armor) return;
        if (recipe.id === "wooden-door" && player.doors.wooden) return;
        if (recipe.id === "metal-door" && player.doors.metal) return;
        var cost = discountedCost(player, recipe.cost);
        if (canPayFromBags(player, cost)) list.push({ type: "craft", recipe: recipe.id });
      });
    }
    if (node.type === "monument" && !player.visited[node.id]) {
      var options = visitPaymentOptions(player);
      if (options.length) list.push({ type: "visit" });
    }
    if (!state.drewCardThisTurn && player.hand.length < HAND_LIMIT && (state.deck.length || state.discard.length)) {
      list.push({ type: "draw" });
    }
    player.hand.forEach(function (cardId) {
      list.push({ type: "play", cardId: cardId });
    });
    list.push({ type: "end" });
    return list;
  }

  function applyMove(state, action) {
    var player = currentPlayer(state);
    var to = action.to;
    if (neighbors(player.node).indexOf(to) === -1) {
      throw new Error("That road is not connected.");
    }
    spendAction(state);
    player.node = to;
    log(state, player.name + " moves to " + getNode(to).name + ".");
    var foe = occupantOn(state, to, player.id);
    if (foe) resolveCombat(state, player, foe, action.dice || {});
    maybeEndTurn(state);
  }

  function applyScavenge(state, action) {
    var player = currentPlayer(state);
    if (bagTotal(player.carry) >= CARRY_LIMIT) throw new Error("Carry is full (5). Deposit at your base.");
    if (!bagHasAnything(state.stocks[player.node])) throw new Error("Nothing left to scavenge here.");
    spendAction(state);
    var take;
    if (action.take && bagTotal(action.take) > 0) {
      if (bagTotal(action.take) > 2) throw new Error("Scavenge at most 2 resources.");
      if (bagTotal(player.carry) + bagTotal(action.take) > CARRY_LIMIT) throw new Error("That would exceed carry 5.");
      take = copyBag(action.take);
      takeStock(state, player.node, take);
    } else {
      take = autoScavengeTake(state, player, 2);
    }
    if (bagTotal(take) === 0) throw new Error("Nothing left to scavenge here.");
    addGain(state, player, take);
    log(state, player.name + " scavenges " + formatBag(take) + " at " + getNode(player.node).name + ".");
    checkScrapWin(state);
    maybeEndTurn(state);
  }

  function applyDeposit(state) {
    var player = currentPlayer(state);
    if (!player.baseNode || player.node !== player.baseNode) throw new Error("Deposit at your own base.");
    if (!bagHasAnything(player.carry)) throw new Error("Carry is empty.");
    spendAction(state);
    var moved = copyBag(player.carry);
    RESOURCES.forEach(function (r) {
      player.storage[r] += player.carry[r];
      player.carry[r] = 0;
    });
    log(state, player.name + " deposits " + formatBag(moved) + " into the cupboard.");
    maybeEndTurn(state);
  }

  function applyBuild(state) {
    var player = currentPlayer(state);
    var node = getNode(player.node);
    if (node.type !== "clearing") throw new Error("Bases go on a clearing.");
    if (player.baseNode) throw new Error("You already planted a cupboard.");
    if (
      state.players.some(function (p) {
        return p.baseNode === node.id;
      })
    ) {
      throw new Error("That clearing already has a base.");
    }
    if (!canPayFromBags(player, { wood: 2, stone: 1 })) throw new Error("Building a base costs 2 wood and 1 stone.");
    spendAction(state);
    payFromBags(player, { wood: 2, stone: 1 }, false);
    player.baseNode = node.id;
    log(state, player.name + " plants a tool cupboard on " + node.name + ".");
    maybeEndTurn(state);
  }

  function applyCraft(state, action) {
    var player = currentPlayer(state);
    var recipe = recipeById(action.recipe);
    if (!recipe) throw new Error("Unknown recipe.");
    if (!player.baseNode || player.node !== player.baseNode) throw new Error("Craft at your base.");
    if (player.workbench < recipe.wb) throw new Error("Need Workbench " + recipe.wb + " to craft " + recipe.name + ".");
    if (recipe.id === "bow" && player.gear.bow) throw new Error("You already carry a bow.");
    if (recipe.id === "revolver" && player.gear.revolver) throw new Error("You already carry a revolver.");
    if (recipe.id === "armor" && player.gear.armor) throw new Error("You already wear armor.");
    if (recipe.id === "wooden-door" && player.doors.wooden) throw new Error("Wooden door is already hung.");
    if (recipe.id === "metal-door" && player.doors.metal) throw new Error("Metal door is already hung.");
    var cost = discountedCost(player, recipe.cost);
    if (!canPayFromBags(player, cost)) throw new Error("Not enough resources for " + recipe.name + ".");
    spendAction(state);
    payFromBags(player, cost, true);
    if (player.craftDiscount) player.craftDiscount = 0;
    if (recipe.id === "bow") player.gear.bow = true;
    if (recipe.id === "revolver") player.gear.revolver = true;
    if (recipe.id === "armor") player.gear.armor = true;
    if (recipe.id === "timed-charge") player.gear.timedCharge += 1;
    if (recipe.id === "wooden-door") player.doors.wooden = true;
    if (recipe.id === "metal-door") player.doors.metal = true;
    log(state, player.name + " crafts " + recipe.name + ".");
    maybeEndTurn(state);
  }

  function applyVisit(state, action) {
    var player = currentPlayer(state);
    var node = getNode(player.node);
    if (node.type !== "monument") throw new Error("Visit a monument you occupy.");
    if (player.visited[node.id]) throw new Error("You already pulled that monument this wipe.");
    var pay = action.pay ? copyBag(action.pay) : defaultVisitPay(player);
    var paidFood = (pay.food || 0) >= 1;
    var paidTwo = bagTotal(pay) >= 2;
    if (!paidFood && !paidTwo) throw new Error("Visit costs 1 food or 2 resources.");
    if (paidFood) pay = { food: 1 };
    if (!canPayFromBags(player, pay)) throw new Error("Cannot pay the visit cost.");
    spendAction(state);
    payFromBags(player, pay, false);
    player.visited[node.id] = true;
    var unlocked = false;
    if (node.wb && player.workbench < node.wb) {
      player.workbench = node.wb;
      unlocked = true;
      log(state, player.name + " visits " + node.name + " and unlocks Workbench " + node.wb + ".");
    } else {
      log(state, player.name + " visits " + node.name + ".");
    }
    if (node.scrap) {
      addGain(state, player, { scrap: node.scrap });
      log(state, player.name + " pockets " + node.scrap + " scrap at " + node.name + ".");
    }
    if (!unlocked && !node.scrap) {
      log(state, "The monument is already in " + player.name + "'s notes.");
    }
    checkScrapWin(state);
    maybeEndTurn(state);
  }

  function applyDraw(state) {
    var player = currentPlayer(state);
    if (state.drewCardThisTurn) throw new Error("Already drew a card this turn.");
    if (player.hand.length >= HAND_LIMIT) throw new Error("Hand is full (3). Play a card first.");
    spendAction(state);
    var cardId = drawFromDeck(state);
    player.hand.push(cardId);
    state.drewCardThisTurn = true;
    var card = cardById(cardId);
    log(state, player.name + " draws " + (card ? card.name : cardId) + ".");
    maybeEndTurn(state);
  }

  function applyPlay(state, action) {
    var player = currentPlayer(state);
    var idx = player.hand.indexOf(action.cardId);
    if (idx === -1) throw new Error("That card is not in hand.");
    var card = cardById(action.cardId);
    if (!card) throw new Error("Unknown card.");
    spendAction(state);
    player.hand.splice(idx, 1);
    state.discard.push(card.id);
    log(state, player.name + " plays " + card.name + ".");
    if (card.gain) addGain(state, player, card.gain);
    if (card.discount) {
      player.craftDiscount += card.discount;
      log(state, player.name + " tucks a craft discount.");
    }
    if (card.woundRisk) {
      var die = rollD6(state, action.dice && action.dice.event);
      if (die <= 3) applyWound(state, player, card.name + " d6=" + die);
      else log(state, player.name + " shrugs off " + card.name + " (d6=" + die + ").");
    }
    checkScrapWin(state);
    maybeEndTurn(state);
  }

  function applyEnd(state) {
    if (state.phase === "over") throw new Error("The wipe is over.");
    state.actionsLeft = 0;
    finishTurn(state);
  }

  function applyAction(state, action) {
    if (!action || !action.type) throw new Error("Missing action.");
    if (action.type === "ack") {
      state.pendingHandoff = false;
      return state;
    }
    if (state.phase !== "playing" && action.type !== "ack") throw new Error("The wipe is over.");
    assertTurn(state, action.playerId);
    switch (action.type) {
      case "move":
        applyMove(state, action);
        break;
      case "scavenge":
        applyScavenge(state, action);
        break;
      case "deposit":
        applyDeposit(state);
        break;
      case "build":
        applyBuild(state);
        break;
      case "craft":
        applyCraft(state, action);
        break;
      case "visit":
        applyVisit(state, action);
        break;
      case "draw":
        applyDraw(state);
        break;
      case "play":
        applyPlay(state, action);
        break;
      case "end":
        applyEnd(state);
        break;
      default:
        throw new Error("Unknown action: " + action.type);
    }
    return state;
  }

  function isLegal(state, action) {
    try {
      var copy = deserialize(serialize(state));
      applyAction(copy, action);
      return true;
    } catch (_) {
      return false;
    }
  }

  function gearList(player) {
    var items = [];
    if (player.gear.bow) items.push("Bow");
    if (player.gear.revolver) items.push("Revolver");
    if (player.gear.armor) items.push("Armor");
    if (player.gear.timedCharge) items.push("Timed Charge ×" + player.gear.timedCharge);
    if (player.doors.wooden) items.push("Wooden Door");
    if (player.doors.metal) items.push("Metal Door");
    return items;
  }

  function nodeLabel(id) {
    return getNode(id).name;
  }

  return {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    RESOURCES: RESOURCES,
    RESOURCE_LABELS: RESOURCE_LABELS,
    CARRY_LIMIT: CARRY_LIMIT,
    ACTIONS_PER_TURN: ACTIONS_PER_TURN,
    HAND_LIMIT: HAND_LIMIT,
    SCRAP_TO_WIN: SCRAP_TO_WIN,
    MAX_ROUNDS: MAX_ROUNDS,
    MAP_NODES: MAP_NODES,
    MAP_EDGES: MAP_EDGES,
    RECIPES: RECIPES,
    CARD_DEFS: CARD_DEFS,
    PLAYER_NAMES: PLAYER_NAMES,
    createGame: createGame,
    applyAction: applyAction,
    legalActions: legalActions,
    isLegal: isLegal,
    serialize: serialize,
    deserialize: deserialize,
    neighbors: neighbors,
    getNode: getNode,
    bagTotal: bagTotal,
    copyBag: copyBag,
    emptyBag: emptyBag,
    formatBag: formatBag,
    recipeById: recipeById,
    cardById: cardById,
    attackBonus: attackBonus,
    defenseBonus: defenseBonus,
    gearList: gearList,
    nodeLabel: nodeLabel,
    hashSeed: hashSeed,
    currentPlayer: currentPlayer,
  };
});
