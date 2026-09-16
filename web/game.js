/**
 * Wipe Table Play — thin-slice 2-player hotseat engine.
 * No DOM. Safe to load in the browser or require() from Node.
 * Uses set, cost, and types only. No card-specific effects.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WipeGame = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = 1;
  var RESOURCES = ["wood", "stone", "cloth"];
  var PHASES = ["gather", "craft", "raid", "end", "over"];
  var MAX_ROUNDS = 8;
  var SCRAP_TO_WIN = 12;
  var DOWNED_DAMAGE = 3;
  var LOG_CAP = 24;
  var STORAGE_VERSION = 1;

  function startingPlayer(name, index) {
    var trimmed = String(name || "").trim();
    if (trimmed.length > 32) trimmed = trimmed.slice(0, 32);
    return {
      name: trimmed || "Player " + (index + 1),
      wood: 2,
      stone: 1,
      cloth: 1,
      scrap: 0,
      damage: 0,
      raidToken: true,
      blueprints: [],
      base: [],
      freeCraftUsed: [],
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hasType(card, type) {
    return (card.types || []).indexOf(type) !== -1;
  }

  function findCard(wipe, cardId) {
    for (var i = 0; i < wipe.length; i++) {
      if (wipe[i].id === cardId) return wipe[i];
    }
    return null;
  }

  function resourceTotal(player) {
    return player.wood + player.stone + player.cloth;
  }

  function planSpend(player, amount) {
    var stocks = { wood: player.wood, stone: player.stone, cloth: player.cloth };
    var spent = { wood: 0, stone: 0, cloth: 0 };
    var remaining = Math.max(0, Math.min(Number(amount) || 0, resourceTotal(player)));
    while (remaining > 0) {
      var pick = RESOURCES[0];
      var bestLeft = -1;
      for (var i = 0; i < RESOURCES.length; i++) {
        var key = RESOURCES[i];
        var left = stocks[key] - spent[key];
        if (left > bestLeft) {
          bestLeft = left;
          pick = key;
        }
      }
      if (bestLeft <= 0) break;
      spent[pick]++;
      remaining--;
    }
    return spent;
  }

  function applySpend(player, spent) {
    player.wood -= spent.wood;
    player.stone -= spent.stone;
    player.cloth -= spent.cloth;
  }

  function spendLabel(spent) {
    var parts = [];
    for (var i = 0; i < RESOURCES.length; i++) {
      var key = RESOURCES[i];
      if (spent[key]) parts.push(spent[key] + " " + key);
    }
    return parts.join(", ") || "nothing";
  }

  function canAfford(player, cost) {
    return resourceTotal(player) >= cost;
  }

  function isCheapSurvival(card) {
    return card.set === "Survival" && card.cost <= 3;
  }

  function usedFreeCraft(player, cardId) {
    return player.freeCraftUsed.indexOf(cardId) !== -1;
  }

  function hasBlueprint(player, cardId) {
    return player.blueprints.indexOf(cardId) !== -1;
  }

  function cardsOnBase(wipe, player) {
    return player.base
      .map(function (id) {
        return findCard(wipe, id);
      })
      .filter(Boolean);
  }

  function raidPower(wipe, player) {
    var raidCards = cardsOnBase(wipe, player).filter(function (card) {
      return hasType(card, "Raid");
    });
    return 1 + raidCards.length;
  }

  function highestDefendCost(wipe, player) {
    var best = 0;
    var cards = cardsOnBase(wipe, player);
    for (var i = 0; i < cards.length; i++) {
      if (hasType(cards[i], "Build") || hasType(cards[i], "Defend")) {
        if (cards[i].cost > best) best = cards[i].cost;
      }
    }
    return best;
  }

  function defenseValue(wipe, player) {
    var bonus = highestDefendCost(wipe, player);
    return bonus ? 1 + bonus : 1;
  }

  function buildingCount(wipe, player) {
    return cardsOnBase(wipe, player).filter(function (card) {
      return hasType(card, "Build");
    }).length;
  }

  function pickBuildToRemove(wipe, player) {
    var cards = cardsOnBase(wipe, player).filter(function (card) {
      return hasType(card, "Build");
    });
    if (!cards.length) return null;
    cards.sort(function (a, b) {
      if (b.cost !== a.cost) return b.cost - a.cost;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    return cards[0];
  }

  function normalizeCard(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Each wipe card must be an object.");
    var id = String(raw.id || "").trim();
    var name = String(raw.name || "").trim();
    if (!id) throw new Error("Each wipe card needs an id.");
    if (!name) throw new Error("Card " + id + " needs a name.");
    var cost = Number(raw.cost);
    if (!Number.isSafeInteger(cost) || cost < 0) {
      throw new Error("Card " + id + " needs a whole-number cost.");
    }
    var types = Array.isArray(raw.types) ? raw.types.map(String) : [];
    return {
      id: id,
      name: name,
      set: String(raw.set || "").trim(),
      cost: cost,
      types: types,
      types_summary: types.join(" / "),
      band: raw.band != null ? String(raw.band) : "",
      icon: String(raw.icon || "mark"),
      rules: String(raw.rules || ""),
      flavor: String(raw.flavor || ""),
    };
  }

  function pushLog(state, line) {
    state.log.push(line);
    if (state.log.length > LOG_CAP) state.log = state.log.slice(-LOG_CAP);
  }

  function current(state) {
    return state.players[state.currentPlayer];
  }

  function opponent(state) {
    return state.players[1 - state.currentPlayer];
  }

  function phaseLabel(phase) {
    if (phase === "gather") return "Gather";
    if (phase === "craft") return "Craft";
    if (phase === "raid") return "Raid";
    if (phase === "end") return "End turn";
    if (phase === "over") return "Wipe over";
    return phase;
  }

  function setWinner(state, playerIndex, reason, extra) {
    var winner = {
      playerIndex: playerIndex,
      name: playerIndex == null ? null : state.players[playerIndex].name,
      reason: reason,
      draw: playerIndex == null,
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        winner[key] = extra[key];
      });
    }
    state.winner = winner;
    state.phase = "over";
    pushLog(state, winner.draw ? "Draw. " + reason : winner.name + " wins. " + reason);
  }

  function checkScrapWin(state) {
    var scores = state.players.map(function (p) {
      return p.scrap;
    });
    var best = Math.max.apply(null, scores);
    if (best < SCRAP_TO_WIN) return;
    var leaders = [];
    for (var i = 0; i < scores.length; i++) if (scores[i] === best) leaders.push(i);
    if (leaders.length === 1) {
      setWinner(state, leaders[0], "Reached " + SCRAP_TO_WIN + " scrap.");
      return;
    }
    resolveRoundWinner(state, true);
  }

  function resolveRoundWinner(state, fromScrapTie) {
    var scored = state.players.map(function (player, index) {
      return {
        index: index,
        scrap: player.scrap,
        buildings: buildingCount(state.wipe, player),
      };
    });
    scored.sort(function (a, b) {
      if (b.scrap !== a.scrap) return b.scrap - a.scrap;
      return b.buildings - a.buildings;
    });
    var top = scored[0];
    var tied = scored.filter(function (row) {
      return row.scrap === top.scrap && row.buildings === top.buildings;
    });
    var prefix = fromScrapTie ? "Scrap race tied. " : "Eight rounds. ";
    if (tied.length > 1) {
      setWinner(state, null, prefix + "Draw on scrap and buildings.", {
        scrap: top.scrap,
        buildings: top.buildings,
      });
      return;
    }
    var reason =
      scored[1] && scored[1].scrap === top.scrap
        ? prefix + "Buildings broke the scrap tie."
        : fromScrapTie
          ? "Reached " + SCRAP_TO_WIN + " scrap."
          : prefix + "Most scrap wins.";
    setWinner(state, top.index, reason, { scrap: top.scrap, buildings: top.buildings });
  }

  function applyDowned(state, player) {
    if (player.damage < DOWNED_DAMAGE) return;
    var discarded = planSpend(player, 2);
    applySpend(player, discarded);
    player.damage = 0;
    player.wood += 1;
    pushLog(
      state,
      player.name +
        " is downed: discarded " +
        spendLabel(discarded) +
        ", damage reset, gained 1 wood."
    );
  }

  function normalizeWipe(wipe) {
    if (!Array.isArray(wipe) || !wipe.length) throw new Error("Play needs tonight's wipe cards.");
    var seen = Object.create(null);
    return wipe.map(function (card) {
      var normalized = normalizeCard(card);
      if (seen[normalized.id]) throw new Error("Duplicate wipe card: " + normalized.id);
      seen[normalized.id] = true;
      return normalized;
    });
  }

  function createGame(options) {
    options = options || {};
    var names = options.names || [];
    var wipe = normalizeWipe(options.wipe);
    var players = [startingPlayer(names[0], 0), startingPlayer(names[1], 1)];
    var state = {
      version: VERSION,
      wipe: wipe,
      seed: options.seed != null ? String(options.seed) : "",
      setCounts: options.setCounts || {},
      meta: options.meta || {},
      players: players,
      currentPlayer: 0,
      phase: "gather",
      round: 1,
      craftedThisTurn: false,
      raidedThisTurn: false,
      log: [],
      winner: null,
    };
    pushLog(state, "Wipe is live. " + players[0].name + " gathers first.");
    return state;
  }

  function parseResources(raw) {
    if (Array.isArray(raw)) {
      return raw.map(function (item) {
        return String(item || "").toLowerCase();
      });
    }
    if (raw && typeof raw === "object") {
      var list = [];
      RESOURCES.forEach(function (key) {
        var n = Number(raw[key]) || 0;
        for (var i = 0; i < n; i++) list.push(key);
      });
      return list;
    }
    return [];
  }

  function inspectGather(state, resources) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "gather") return { ok: false, reason: "Gather is already done this turn." };
    if (!resources) return { ok: true, reason: "" };
    if (resources.length !== 2) return { ok: false, reason: "Pick exactly 2 resources." };
    for (var i = 0; i < resources.length; i++) {
      if (RESOURCES.indexOf(resources[i]) === -1) {
        return { ok: false, reason: "Gather only wood, stone, or cloth." };
      }
    }
    return { ok: true, reason: "" };
  }

  function inspectSkipCraft(state) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "craft") return { ok: false, reason: "Not the craft step." };
    return { ok: true, reason: "" };
  }

  function inspectUnlock(state, cardId) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "craft") return { ok: false, reason: "Unlock during the craft step." };
    if (state.craftedThisTurn) return { ok: false, reason: "Already used this turn's craft." };
    var card = findCard(state.wipe, cardId);
    if (!card) return { ok: false, reason: "That card is not in tonight's wipe." };
    var player = current(state);
    if (hasBlueprint(player, card.id)) return { ok: false, reason: "Already unlocked." };
    if (!canAfford(player, card.cost)) {
      return { ok: false, reason: "Need " + card.cost + " resources; have " + resourceTotal(player) + "." };
    }
    return { ok: true, reason: "" };
  }

  function inspectCraft(state, cardId) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "craft") return { ok: false, reason: "Craft during the craft step." };
    if (state.craftedThisTurn) return { ok: false, reason: "Already used this turn's craft." };
    var card = findCard(state.wipe, cardId);
    if (!card) return { ok: false, reason: "That card is not in tonight's wipe." };
    var player = current(state);
    var unlocked = hasBlueprint(player, card.id);
    var freeOk = isCheapSurvival(card) && !usedFreeCraft(player, card.id);
    if (!unlocked && !freeOk) {
      if (isCheapSurvival(card)) {
        return { ok: false, reason: "Cheap Survival already used; unlock it first." };
      }
      return { ok: false, reason: "Unlock this card before crafting it onto your base." };
    }
    if (!canAfford(player, card.cost)) {
      return { ok: false, reason: "Need " + card.cost + " resources; have " + resourceTotal(player) + "." };
    }
    return { ok: true, reason: "", free: freeOk && !unlocked };
  }

  function inspectRaid(state) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "raid") return { ok: false, reason: "Raid after the craft step." };
    if (state.raidedThisTurn) return { ok: false, reason: "Already raided this turn." };
    if (!current(state).raidToken) return { ok: false, reason: "Raid token returns next turn." };
    return { ok: true, reason: "" };
  }

  function inspectSkipRaid(state) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "raid") return { ok: false, reason: "Not the raid step." };
    return { ok: true, reason: "" };
  }

  function inspectEndTurn(state) {
    if (state.winner) return { ok: false, reason: "The wipe is already over." };
    if (state.phase !== "end") return { ok: false, reason: "Finish gather, craft, and raid first." };
    return { ok: true, reason: "" };
  }

  function inspectAction(state, action) {
    action = action || {};
    var type = action.type;
    if (type === "gather") return inspectGather(state, action.resources ? parseResources(action.resources) : null);
    if (type === "skipCraft") return inspectSkipCraft(state);
    if (type === "unlock") return inspectUnlock(state, action.cardId);
    if (type === "craft") return inspectCraft(state, action.cardId);
    if (type === "raid") return inspectRaid(state);
    if (type === "skipRaid") return inspectSkipRaid(state);
    if (type === "endTurn") return inspectEndTurn(state);
    return { ok: false, reason: "Unknown action." };
  }

  function doGather(state, resources) {
    var player = current(state);
    for (var i = 0; i < resources.length; i++) player[resources[i]] += 1;
    state.phase = "craft";
    var counts = { wood: 0, stone: 0, cloth: 0 };
    resources.forEach(function (key) {
      counts[key]++;
    });
    pushLog(state, player.name + " gathered " + spendLabel(counts) + ".");
  }

  function doUnlock(state, cardId) {
    var player = current(state);
    var card = findCard(state.wipe, cardId);
    var spent = planSpend(player, card.cost);
    applySpend(player, spent);
    player.blueprints.push(card.id);
    state.craftedThisTurn = true;
    state.phase = "raid";
    pushLog(state, player.name + " unlocked " + card.name + " for " + spendLabel(spent) + ".");
  }

  function doCraft(state, cardId) {
    var player = current(state);
    var card = findCard(state.wipe, cardId);
    var unlocked = hasBlueprint(player, card.id);
    var spent = planSpend(player, card.cost);
    applySpend(player, spent);
    player.base.push(card.id);
    if (!unlocked) player.freeCraftUsed.push(card.id);
    state.craftedThisTurn = true;
    state.phase = "raid";
    pushLog(
      state,
      player.name +
        " crafted " +
        card.name +
        " onto their base for " +
        spendLabel(spent) +
        (unlocked ? "." : " (cheap Survival, no unlock).")
    );
  }

  function doRaid(state) {
    var attacker = current(state);
    var defender = opponent(state);
    var power = raidPower(state.wipe, attacker);
    var defense = defenseValue(state.wipe, defender);
    attacker.raidToken = false;
    state.raidedThisTurn = true;
    state.phase = "end";
    if (power >= defense) {
      var stolen = 0;
      if (defender.scrap <= 0) {
        attacker.scrap += 2;
      } else {
        stolen = Math.min(2, defender.scrap);
        defender.scrap -= stolen;
        attacker.scrap += stolen;
      }
      var removed = pickBuildToRemove(state.wipe, defender);
      if (removed) {
        var idx = defender.base.indexOf(removed.id);
        if (idx !== -1) defender.base.splice(idx, 1);
      }
      pushLog(
        state,
        attacker.name +
          " raided " +
          defender.name +
          " (" +
          power +
          " vs " +
          defense +
          ") and " +
          (defender.scrap + stolen <= 0 && stolen === 0 ? "took 2 scrap from the island" : "stole " + stolen + " scrap") +
          (removed ? ", wrecked " + removed.name : "") +
          "."
      );
      checkScrapWin(state);
      return;
    }
    attacker.damage += 1;
    pushLog(
      state,
      attacker.name +
        " failed a raid on " +
        defender.name +
        " (" +
        power +
        " vs " +
        defense +
        ") and took 1 damage."
    );
    applyDowned(state, attacker);
  }

  function doEndTurn(state) {
    var actor = current(state);
    var nextIndex = 1 - state.currentPlayer;
    if (nextIndex === 0) {
      if (state.round >= MAX_ROUNDS) {
        resolveRoundWinner(state, false);
        return;
      }
      state.round += 1;
    }
    state.currentPlayer = nextIndex;
    state.phase = "gather";
    state.craftedThisTurn = false;
    state.raidedThisTurn = false;
    state.players[nextIndex].raidToken = true;
    pushLog(state, actor.name + " ended the turn. Round " + state.round + ", " + current(state).name + " up.");
  }

  function applyAction(state, action) {
    if (!state || typeof state !== "object") throw new Error("Missing game state.");
    action = action || {};
    var next = clone(state);
    var resources = action.type === "gather" ? parseResources(action.resources) : null;
    var check = inspectAction(next, {
      type: action.type,
      cardId: action.cardId,
      resources: resources,
    });
    if (!check.ok) throw new Error(check.reason || "Illegal action.");
    if (action.type === "gather") doGather(next, resources);
    else if (action.type === "skipCraft") {
      next.phase = "raid";
      pushLog(next, current(next).name + " skipped craft.");
    } else if (action.type === "unlock") doUnlock(next, action.cardId);
    else if (action.type === "craft") doCraft(next, action.cardId);
    else if (action.type === "raid") doRaid(next);
    else if (action.type === "skipRaid") {
      next.phase = "end";
      pushLog(next, current(next).name + " skipped raid.");
    } else if (action.type === "endTurn") doEndTurn(next);
    return next;
  }

  function cardView(state, card) {
    return {
      card: card,
      unlock: inspectUnlock(state, card.id),
      craft: inspectCraft(state, card.id),
    };
  }

  function playerView(state, player, index) {
    return {
      index: index,
      name: player.name,
      wood: player.wood,
      stone: player.stone,
      cloth: player.cloth,
      scrap: player.scrap,
      damage: player.damage,
      raidToken: player.raidToken,
      resources: resourceTotal(player),
      blueprints: player.blueprints
        .map(function (id) {
          return findCard(state.wipe, id);
        })
        .filter(Boolean),
      base: cardsOnBase(state.wipe, player),
      buildings: buildingCount(state.wipe, player),
      raidPower: raidPower(state.wipe, player),
      defense: defenseValue(state.wipe, player),
      isCurrent: index === state.currentPlayer,
    };
  }

  function getView(state) {
    var you = current(state);
    var them = opponent(state);
    return {
      version: state.version,
      seed: state.seed,
      round: state.round,
      maxRounds: MAX_ROUNDS,
      phase: state.phase,
      phaseLabel: phaseLabel(state.phase),
      currentPlayer: state.currentPlayer,
      winner: state.winner,
      log: state.log.slice(),
      wipe: state.wipe,
      players: state.players.map(function (player, index) {
        return playerView(state, player, index);
      }),
      raidPreview: {
        power: raidPower(state.wipe, you),
        defense: defenseValue(state.wipe, them),
        target: them.name,
      },
      actions: {
        gather: inspectGather(state, null),
        skipCraft: inspectSkipCraft(state),
        raid: inspectRaid(state),
        skipRaid: inspectSkipRaid(state),
        endTurn: inspectEndTurn(state),
        cards: state.wipe.map(function (card) {
          return cardView(state, card);
        }),
      },
    };
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function parse(raw) {
    var data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") throw new Error("Saved match is empty.");
    if (data.version !== STORAGE_VERSION) throw new Error("Saved match version is not supported.");
    if (!Array.isArray(data.wipe) || !data.wipe.length) throw new Error("Saved match is missing the wipe.");
    if (!Array.isArray(data.players) || data.players.length !== 2) {
      throw new Error("Saved match must be exactly 2 players.");
    }
    if (PHASES.indexOf(data.phase) === -1) throw new Error("Saved match has a bad phase.");
    data.wipe = normalizeWipe(data.wipe);
    data.players = data.players.map(function (player, index) {
      if (!player || typeof player !== "object") throw new Error("Saved player is missing.");
      return {
        name: String(player.name || "Player " + (index + 1)),
        wood: Number(player.wood) || 0,
        stone: Number(player.stone) || 0,
        cloth: Number(player.cloth) || 0,
        scrap: Number(player.scrap) || 0,
        damage: Number(player.damage) || 0,
        raidToken: !!player.raidToken,
        blueprints: Array.isArray(player.blueprints) ? player.blueprints.map(String) : [],
        base: Array.isArray(player.base) ? player.base.map(String) : [],
        freeCraftUsed: Array.isArray(player.freeCraftUsed) ? player.freeCraftUsed.map(String) : [],
      };
    });
    data.log = Array.isArray(data.log) ? data.log.map(String) : [];
    data.currentPlayer = data.currentPlayer === 1 ? 1 : 0;
    data.round = Number(data.round) || 1;
    data.craftedThisTurn = !!data.craftedThisTurn;
    data.raidedThisTurn = !!data.raidedThisTurn;
    data.seed = data.seed != null ? String(data.seed) : "";
    data.setCounts = data.setCounts || {};
    data.meta = data.meta || {};
    data.winner = data.winner || null;
    data.version = VERSION;
    return data;
  }

  return {
    VERSION: VERSION,
    RESOURCES: RESOURCES,
    MAX_ROUNDS: MAX_ROUNDS,
    SCRAP_TO_WIN: SCRAP_TO_WIN,
    DOWNED_DAMAGE: DOWNED_DAMAGE,
    createGame: createGame,
    applyAction: applyAction,
    inspectAction: inspectAction,
    getView: getView,
    serialize: serialize,
    parse: parse,
    clone: clone,
    planSpend: planSpend,
    canAfford: canAfford,
    raidPower: raidPower,
    defenseValue: defenseValue,
    buildingCount: buildingCount,
    resourceTotal: resourceTotal,
    phaseLabel: phaseLabel,
    isCheapSurvival: isCheapSurvival,
  };
});
