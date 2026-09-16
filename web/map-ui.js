(function () {
  "use strict";

  var G = window.WipeMapGame;
  var SVG = "http://www.w3.org/2000/svg";
  var CHIP_COLORS = {
    wood: "#7d8a45",
    stone: "#9a8b78",
    metal: "#7f98a3",
    sulfur: "#d4b46a",
    cloth: "#cbb79a",
    food: "#c45c3a",
    scrap: "#d4782e",
  };
  var TYPE_COLORS = {
    beach: "#d4b46a",
    resource: "#7d8a45",
    clearing: "#c4a070",
    monument: "#5b7d86",
  };

  var state = null;
  var selected = null;
  var shownCombatKey = "";
  var toastTimer;

  function $(id) {
    return document.getElementById(id);
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(function () {
      $("toast").hidden = true;
    }, 3200);
  }

  function persist() {
    try {
      localStorage.setItem(G.STORAGE_KEY, G.serialize(state));
    } catch (_) {
      toast("This browser can't save the map right now.");
    }
  }

  function loadSaved() {
    try {
      var raw = localStorage.getItem(G.STORAGE_KEY);
      if (!raw) return null;
      return G.deserialize(raw);
    } catch (_) {
      return null;
    }
  }

  function act(action) {
    try {
      G.applyAction(state, action);
      persist();
      render();
    } catch (error) {
      toast(error.message || "That action isn't legal.");
    }
  }

  function legalSet() {
    var set = Object.create(null);
    G.legalActions(state).forEach(function (a) {
      var key = a.type;
      if (a.to) key += ":" + a.to;
      if (a.recipe) key += ":" + a.recipe;
      if (a.cardId) key += ":" + a.cardId;
      set[key] = a;
    });
    return set;
  }

  function iconFor(node) {
    var g = svgEl("g", { class: "node-icon", transform: "translate(" + node.x + " " + node.y + ")" });
    if (node.type === "beach") {
      g.appendChild(svgEl("path", { d: "M-14 4 C-6 -8 8 -8 14 4 L10 6 C4 -2 -4 -2 -10 6 Z", fill: "currentColor" }));
      g.appendChild(svgEl("circle", { cx: "0", cy: "-8", r: "4", fill: "currentColor", opacity: "0.7" }));
    } else if (node.type === "clearing") {
      g.appendChild(svgEl("rect", { x: "-10", y: "-10", width: "20", height: "20", rx: "3", fill: "none", stroke: "currentColor", "stroke-width": "2" }));
      g.appendChild(svgEl("rect", { x: "-4", y: "-4", width: "8", height: "8", fill: "currentColor" }));
    } else if (node.monument === "outpost") {
      g.appendChild(svgEl("rect", { x: "-11", y: "-6", width: "22", height: "14", fill: "currentColor" }));
      g.appendChild(svgEl("polygon", { points: "-13,-6 0,-16 13,-6", fill: "currentColor" }));
    } else if (node.monument === "airfield") {
      g.appendChild(svgEl("rect", { x: "-16", y: "-3", width: "32", height: "6", rx: "1", fill: "currentColor" }));
      g.appendChild(svgEl("rect", { x: "-3", y: "-14", width: "6", height: "28", rx: "1", fill: "currentColor" }));
    } else if (node.monument === "launch") {
      g.appendChild(svgEl("polygon", { points: "0,-16 8,10 -8,10", fill: "currentColor" }));
      g.appendChild(svgEl("rect", { x: "-3", y: "8", width: "6", height: "8", fill: "currentColor" }));
    } else if (node.monument === "bandit") {
      g.appendChild(svgEl("circle", { cx: "0", cy: "-4", r: "6", fill: "currentColor" }));
      g.appendChild(svgEl("rect", { x: "-8", y: "2", width: "16", height: "10", fill: "currentColor" }));
    } else if (node.monument === "train") {
      g.appendChild(svgEl("rect", { x: "-14", y: "-8", width: "28", height: "14", rx: "2", fill: "currentColor" }));
      g.appendChild(svgEl("circle", { cx: "-8", cy: "8", r: "3.5", fill: "currentColor" }));
      g.appendChild(svgEl("circle", { cx: "8", cy: "8", r: "3.5", fill: "currentColor" }));
    } else {
      g.appendChild(svgEl("polygon", { points: "0,-12 10,0 0,12 -10,0", fill: "currentColor" }));
    }
    return g;
  }

  function drawBoard() {
    var svg = $("mapSvg");
    while (svg.childNodes.length) svg.removeChild(svg.lastChild);
    var defs = svgEl("defs");
    var grit = svgEl("pattern", { id: "grit", width: "48", height: "48", patternUnits: "userSpaceOnUse" });
    grit.appendChild(svgEl("path", { d: "M0 48 L48 0", stroke: "#3a2e24", "stroke-width": "0.6" }));
    defs.appendChild(grit);
    svg.appendChild(defs);

    var bg = svgEl("g", { "aria-hidden": "true" });
    bg.appendChild(svgEl("rect", { x: "0", y: "0", width: "1000", height: "780", fill: "#0b0907" }));
    bg.appendChild(svgEl("rect", { x: "0", y: "0", width: "1000", height: "780", fill: "url(#grit)", opacity: "0.45" }));
    bg.appendChild(
      svgEl("path", {
        d: "M120,250 C70,120 280,18 500,28 C730,16 950,110 910,255 C972,390 940,530 800,655 C670,790 360,800 250,675 C120,585 70,390 120,250 Z",
        fill: "#1a1510",
        stroke: "#3d3126",
        "stroke-width": "4",
      })
    );
    bg.appendChild(
      svgEl("path", {
        d: "M160,270 C130,170 300,70 500,78 C700,68 880,150 850,270 C900,390 860,520 740,620 C620,720 390,730 300,620 C190,540 150,380 160,270 Z",
        fill: "none",
        stroke: "#2c241c",
        "stroke-width": "2",
        "stroke-dasharray": "6 10",
      })
    );
    svg.appendChild(bg);

    var roads = svgEl("g", { class: "roads" });
    G.MAP_EDGES.forEach(function (edge) {
      var a = G.getNode(edge[0]);
      var b = G.getNode(edge[1]);
      roads.appendChild(svgEl("line", { class: "map-road", x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      roads.appendChild(svgEl("line", { class: "map-road-inner", x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
    });
    svg.appendChild(roads);

    var legal = legalSet();
    var here = G.currentPlayer(state).node;
    G.MAP_NODES.forEach(function (node) {
      var group = svgEl("g", {
        class: "map-node",
        tabindex: "0",
        role: "button",
        "data-id": node.id,
      });
      group.setAttribute("aria-label", node.name);
      var color = TYPE_COLORS[node.type] || "#c4a070";
      group.style.color = color;
      if (selected === node.id) group.classList.add("is-selected");
      if (here === node.id) group.classList.add("is-here");
      if (legal["move:" + node.id]) group.classList.add("is-legal");

      group.appendChild(svgEl("circle", { class: "node-halo", cx: node.x, cy: node.y, r: "42" }));
      group.appendChild(svgEl("circle", { class: "node-pad", cx: node.x, cy: node.y, r: "28" }));
      group.appendChild(iconFor(node));

      var sub = node.type === "monument" && node.wb ? "WB" + node.wb : node.type;
      if (node.type === "beach") sub = node.spawn === 0 ? "Ash spawn" : "Tide spawn";
      group.appendChild(
        svgEl("text", { class: "node-name", x: node.x, y: node.y + 44 })
      ).textContent = node.name;
      group.appendChild(
        svgEl("text", { class: "node-sub", x: node.x, y: node.y + 58 })
      ).textContent = sub;

      state.players.forEach(function (p) {
        if (p.baseNode === node.id) {
          group.appendChild(
            svgEl("rect", {
              class: "base-mark",
              x: node.x + 16,
              y: node.y - 26,
              width: "12",
              height: "12",
              rx: "2",
              fill: p.color,
            })
          );
        }
      });

      var chips = svgEl("g", { class: "chips" });
      var bag = state.stocks[node.id] || G.emptyBag();
      var slot = 0;
      G.RESOURCES.forEach(function (r) {
        var n = bag[r] || 0;
        if (!n) return;
        var shown = Math.min(n, 4);
        for (var i = 0; i < shown; i++) {
          var cx = node.x - 16 + (slot % 4) * 11;
          var cy = node.y + 18 + Math.floor(slot / 4) * 10;
          chips.appendChild(
            svgEl("circle", {
              class: "chip",
              cx: cx,
              cy: cy,
              r: "4.2",
              fill: CHIP_COLORS[r],
            })
          );
          slot += 1;
        }
      });
      group.appendChild(chips);

      var occupants = state.players.filter(function (p) {
        return p.node === node.id;
      });
      occupants.forEach(function (p, i) {
        var ox = occupants.length === 1 ? node.x : node.x - 10 + i * 20;
        var token = svgEl("polygon", {
          class: "token token-" + (p.id === 0 ? "ash" : "tide"),
          points: ox + "," + (node.y - 22) + " " + (ox + 9) + "," + (node.y - 6) + " " + (ox - 9) + "," + (node.y - 6),
        });
        group.appendChild(token);
      });

      group.addEventListener("click", function () {
        onNodeClick(node.id);
      });
      group.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNodeClick(node.id);
        }
      });
      svg.appendChild(group);
    });
  }

  function onNodeClick(id) {
    var legal = legalSet();
    if (legal["move:" + id] && state.phase === "playing") {
      selected = id;
      act({ type: "move", to: id });
      return;
    }
    selected = id;
    render();
  }

  function bagText(bag) {
    return G.formatBag(bag);
  }

  function playerBlock(player, isActive) {
    var gear = G.gearList(player);
    var html = "";
    html += '<div class="player-head">';
    html +=
      "<h2 class=\"player-name\"><i class=\"swatch\" style=\"background:" +
      player.color +
      "\"></i>" +
      player.name +
      (isActive ? " · to play" : "") +
      "</h2>";
    html += "<span>WB " + player.workbench + "</span>";
    html += "</div>";
    html += '<dl class="stat-grid">';
    html += "<div><dt>On</dt><dd>" + G.nodeLabel(player.node) + "</dd></div>";
    html += "<div><dt>Scrap</dt><dd>" + player.scrap + " / 12</dd></div>";
    html += "<div><dt>Wounds</dt><dd>" + player.wounds + " / 3</dd></div>";
    html +=
      "<div><dt>Base</dt><dd>" +
      (player.baseNode ? G.nodeLabel(player.baseNode) : "none") +
      "</dd></div>";
    html += "</dl>";
    html += '<p class="bag-line"><strong>Carry</strong> (' + G.bagTotal(player.carry) + "/5): " + bagText(player.carry) + "</p>";
    html += '<p class="bag-line"><strong>Cupboard</strong>: ' + bagText(player.storage) + "</p>";
    html += '<p class="gear-line"><strong>Gear</strong>: ' + (gear.length ? gear.join(" · ") : "naked") + "</p>";
    if (player.craftDiscount) html += '<p class="gear-line">Craft discount ready.</p>';
    return html;
  }

  function renderHud() {
    var me = G.currentPlayer(state);
    var foe = state.players[me.id === 0 ? 1 : 0];
    $("activeCard").innerHTML = '<p class="eyebrow">ACTIVE</p>' + playerBlock(me, true);
    $("opponentCard").innerHTML = '<p class="eyebrow">ACROSS THE TABLE</p>' + playerBlock(foe, false);

    var pips = $("turnPips");
    pips.replaceChildren();
    for (var i = 0; i < 2; i++) {
      var pip = document.createElement("span");
      if (i < state.actionsLeft) pip.className = "on";
      pips.appendChild(pip);
    }
    var line = me.name + " · round " + state.round + " · " + state.actionsLeft + " action" + (state.actionsLeft === 1 ? "" : "s") + " left";
    if (state.phase === "over") line = "Wipe over — " + state.winReason;
    $("turnLine").textContent = line;

    var banner = $("winBanner");
    if (state.phase === "over") {
      banner.hidden = false;
      banner.textContent = state.winReason;
    } else {
      banner.hidden = true;
    }
  }

  function renderInspect() {
    var box = $("inspectCard");
    var id = selected || G.currentPlayer(state).node;
    var node = G.getNode(id);
    var stock = state.stocks[id] || G.emptyBag();
    var html = '<p class="eyebrow">NODE</p><h2 class="player-name">' + node.name + "</h2>";
    html += '<p class="bag-line">' + node.type + (node.wb ? " · unlocks WB" + node.wb : "") + "</p>";
    html += '<p class="bag-line">Chips: ' + bagText(stock) + "</p>";
    var sitting = state.players.filter(function (p) {
      return p.node === id;
    });
    html +=
      '<p class="bag-line">Tokens: ' +
      (sitting.length ? sitting.map(function (p) { return p.name; }).join(", ") : "empty") +
      "</p>";
    var legal = legalSet();
    if (legal["move:" + id]) {
      html += '<p class="help">Adjacent — tap the node on the map to walk the road.</p>';
    }
    box.innerHTML = html;
  }

  function renderActions() {
    var tray = $("actionTray");
    tray.replaceChildren();
    var legal = legalSet();
    var playing = state.phase === "playing";

    function add(label, action, primary) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      var key = action.type + (action.recipe ? ":" + action.recipe : "") + (action.cardId ? ":" + action.cardId : "");
      var allowed = playing && (action.type === "end" || legal[key] || legal[action.type] || (action.to && legal["move:" + action.to]));
      if (action.type === "end") allowed = playing;
      btn.disabled = !allowed;
      if (primary) btn.className = "primary-action";
      if (action.type === "end") btn.className = "end-action";
      btn.addEventListener("click", function () {
        act(action);
      });
      tray.appendChild(btn);
      return btn;
    }

    add("Scavenge", { type: "scavenge" }, !!legal.scavenge);
    add("Deposit", { type: "deposit" });
    add("Build base", { type: "build" }, !!legal.build);
    add("Visit monument", { type: "visit" }, !!legal.visit);
    add("Draw card", { type: "draw" });
    add("End turn", { type: "end" });

    var crafts = G.RECIPES.filter(function (recipe) {
      return !!legal["craft:" + recipe.id];
    });
    if (crafts.length) {
      crafts.forEach(function (recipe) {
        add("Craft " + recipe.name, { type: "craft", recipe: recipe.id }, true);
      });
    }
  }

  function renderRecipes() {
    var me = G.currentPlayer(state);
    var box = $("recipeCard");
    var html = '<p class="eyebrow">CRAFTS</p>';
    html += '<ul class="recipe-list">';
    G.RECIPES.forEach(function (recipe) {
      var locked = me.workbench < recipe.wb;
      html +=
        "<li class=\"" +
        (locked ? "is-locked" : "") +
        "\"><strong>" +
        recipe.name +
        "</strong> · WB" +
        recipe.wb +
        " · " +
        G.formatBag(recipe.cost) +
        (locked ? " (locked)" : "") +
        "</li>";
    });
    html += "</ul>";
    box.innerHTML = html;
  }

  function renderHand() {
    var list = $("handList");
    list.replaceChildren();
    var me = G.currentPlayer(state);
    if (!me.hand.length) {
      var empty = document.createElement("p");
      empty.className = "help-empty";
      empty.textContent = state.drewCardThisTurn ? "No cards in hand." : "Draw once per turn (max 3).";
      list.appendChild(empty);
      return;
    }
    me.hand.forEach(function (id) {
      var card = G.cardById(id);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.disabled = state.phase !== "playing";
      var tag = document.createElement("span");
      tag.className = "card-type-tag";
      tag.textContent = card.type;
      btn.appendChild(tag);
      btn.appendChild(document.createTextNode(card.name + " — " + card.text));
      btn.addEventListener("click", function () {
        act({ type: "play", cardId: id });
      });
      list.appendChild(btn);
    });
  }

  function renderLog() {
    var list = $("logList");
    list.replaceChildren();
    state.log.slice(0, 24).forEach(function (entry) {
      var li = document.createElement("li");
      li.textContent = "R" + entry.round + " · " + entry.text;
      list.appendChild(li);
    });
  }

  function combatKey(combat) {
    if (!combat) return "";
    return [combat.node, combat.attackerId, combat.defenderId, combat.attack.die, combat.defense.die, combat.attack.total, state.turnsCompleted].join(":");
  }

  function renderCombat() {
    var combat = state.lastCombat;
    if (!combat) return;
    var key = combatKey(combat);
    if (key === shownCombatKey) return;
    shownCombatKey = key;
    var attacker = state.players[combat.attackerId];
    var defender = state.players[combat.defenderId];
    var body = $("combatBody");
    var title = document.createElement("h2");
    title.id = "combatTitle";
    title.textContent = "Fight on " + G.nodeLabel(combat.node);
    var grid = document.createElement("div");
    grid.className = "combat-grid";
    function col(player, side, label) {
      var wrap = document.createElement("div");
      wrap.className = "combat-col";
      var h = document.createElement("p");
      h.className = "eyebrow";
      h.textContent = label;
      var name = document.createElement("h3");
      name.textContent = player.name;
      var math = document.createElement("p");
      math.textContent = side.parts.join(" + ") + " + d6 ";
      var die = document.createElement("span");
      die.className = "die-pip";
      die.textContent = String(side.die);
      math.appendChild(die);
      var total = document.createElement("p");
      total.className = "combat-total";
      total.textContent = String(side.total);
      wrap.append(h, name, math, total);
      return wrap;
    }
    grid.append(col(attacker, combat.attack, "Attack"), col(defender, combat.defense, "Defense"));
    var result = document.createElement("p");
    result.textContent = combat.text;
    if (combat.loot && combat.loot.scrapToken) result.textContent += " Winner takes a scrap token.";
    if (combat.loot && combat.loot.bag && G.bagTotal(combat.loot.bag)) {
      result.textContent += " Loot: " + G.formatBag(combat.loot.bag) + ".";
    }
    if (combat.wound) result.textContent += " Loser takes a wound.";
    if (combat.downed) result.textContent += " Downed — dropped carry and respawned.";
    body.replaceChildren(title, grid, result);
    if (typeof $("combatDialog").showModal === "function") $("combatDialog").showModal();
  }

  function renderHandoff() {
    var overlay = $("handoff");
    if (state.phase === "over" || !state.pendingHandoff) {
      overlay.hidden = true;
      return;
    }
    if ($("combatDialog").open) {
      overlay.hidden = true;
      return;
    }
    var me = G.currentPlayer(state);
    $("handoffTitle").textContent = "Pass to " + me.name;
    $("handoffBody").textContent = me.name + " should take the device. Round " + state.round + ".";
    overlay.hidden = false;
  }

  function render() {
    if (!state) return;
    drawBoard();
    renderHud();
    renderInspect();
    renderActions();
    renderRecipes();
    renderHand();
    renderLog();
    renderCombat();
    renderHandoff();
  }

  function newGame(force) {
    if (!force && state && state.phase === "playing" && state.turnsCompleted > 0) {
      if (!window.confirm("Start a new island? The current wipe will be dropped.")) return;
    }
    state = G.createGame();
    selected = state.players[0].node;
    shownCombatKey = "";
    persist();
    render();
  }

  function wire() {
    $("rulesBtn").addEventListener("click", function () {
      $("rulesDialog").showModal();
    });
    $("newGameBtn").addEventListener("click", function () {
      newGame(false);
    });
    $("handoffBtn").addEventListener("click", function () {
      act({ type: "ack" });
    });
    $("combatDialog").addEventListener("close", function () {
      renderHandoff();
    });
    document.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        $(button.dataset.close).close();
      });
    });
  }

  function boot() {
    wire();
    var saved = loadSaved();
    if (saved) {
      state = saved;
      selected = G.currentPlayer(state).node;
      shownCombatKey = combatKey(state.lastCombat);
      render();
      toast("Resumed the island saved on this browser.");
    } else {
      newGame(true);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
