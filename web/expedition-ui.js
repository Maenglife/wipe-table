(function () {
  "use strict";

  var game = window.WipeExpedition;
  var GAME_KEY = "wipe-table.expedition.game.v1";
  var MEMORY_KEY = "wipe-table.expedition.memory.v1";
  var state = null;
  var toastTimer;
  var DEMO = [
    { seed: "wipe-1", label: "Harbor scrap", note: "Components by Train Yard — stay small, recycle." },
    { seed: "wipe-4", label: "Inland ore", note: "Rich ore on the ridge — furnace and storage." },
    { seed: "wipe-0", label: "Long route", note: "Monuments far apart — small home, far outpost." },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function make(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
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
    if (!state) return;
    try {
      localStorage.setItem(GAME_KEY, game.serialize(state));
    } catch (_) {
      toast("This browser can't save the wipe.");
    }
  }

  function loadSaved() {
    try {
      var raw = localStorage.getItem(GAME_KEY);
      return raw ? game.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loadMemory() {
    try {
      var raw = localStorage.getItem(MEMORY_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function remember(summary) {
    var memory = loadMemory().filter(function (row) {
      return row.seed !== summary.seed;
    });
    memory.unshift({
      seed: summary.seed,
      layoutName: summary.layoutName,
      shape: summary.shape,
      stations: summary.stations,
      contrast: summary.contrast,
      days: summary.days,
    });
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memory.slice(0, 12)));
    } catch (_) {
      /* ignore quota */
    }
  }

  function querySeed() {
    return new URLSearchParams(window.location.search).get("seed");
  }

  function wantsNew() {
    return new URLSearchParams(window.location.search).get("new") === "1";
  }

  function setHidden(id, hidden) {
    $(id).hidden = hidden;
  }

  function chip(label, value) {
    var span = make("span", "stat-chip");
    span.append(make("em", "", label), document.createTextNode(String(value)));
    return span;
  }

  function setButton(button, check) {
    var ok = check && check.ok;
    button.disabled = !ok;
    button.title = ok ? check.reason || "" : (check && check.reason) || "Unavailable.";
    button.setAttribute("aria-disabled", String(!ok));
  }

  function act(action) {
    if (!state) return;
    try {
      var wasOver = !!state.ended;
      state = game.applyAction(state, action);
      persist();
      if (state.ended && !wasOver) remember(state.ended);
      render();
    } catch (error) {
      toast(error.message || "That action isn't legal.");
    }
  }

  function startWipe(seed) {
    state = game.createGame({ seed: seed || undefined });
    persist();
    var url = new URL(window.location.href);
    url.searchParams.delete("new");
    if (state.seed) url.searchParams.set("seed", state.seed);
    window.history.replaceState({}, "", url.pathname + url.search);
    render();
  }

  function nodeLabel(nodes) {
    return Object.keys(nodes || {})
      .filter(function (key) {
        return nodes[key] > 0;
      })
      .map(function (key) {
        return nodes[key] + " " + key;
      })
      .join(" · ");
  }

  function stationLabel(station) {
    return (
      {
        bag: "Bag",
        furnace: "Furnace",
        recycler: "Recycler",
        cupboard: "Cupboard",
        workbench: "Workbench",
        storage: "Storage",
      }[station] || "Empty"
    );
  }

  function renderPortrait(base) {
    var wrap = make("div", "portrait-wrap");
    var rooms = (base.camp && base.camp.rooms) || [];
    var shape = (base.camp && base.camp.shape) || "none";
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "portrait-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Base portrait " + shape);

    function rect(x, y, w, h, label, filled) {
      var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", w);
      r.setAttribute("height", h);
      r.setAttribute("rx", "8");
      r.setAttribute("fill", filled ? "#2a2118" : "#14100c");
      r.setAttribute("stroke", filled ? "#d4b46a" : "rgba(232,196,148,0.28)");
      r.setAttribute("stroke-width", "2");
      svg.appendChild(r);
      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x + w / 2);
      t.setAttribute("y", y + h / 2 + 5);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("fill", "#efe4d2");
      t.setAttribute("font-size", "14");
      t.setAttribute("font-family", "IBM Plex Sans, sans-serif");
      t.textContent = label;
      svg.appendChild(t);
    }

    if (shape === "none") {
      rect(40, 70, 120, 60, "empty beach", false);
    } else if (shape === "1x1") {
      rect(55, 55, 90, 90, stationLabel(rooms[0] && rooms[0].station), !!(rooms[0] && rooms[0].station));
    } else if (shape === "1x2") {
      rect(16, 55, 80, 90, stationLabel(rooms[0] && rooms[0].station), !!(rooms[0] && rooms[0].station));
      rect(104, 55, 80, 90, stationLabel(rooms[1] && rooms[1].station), !!(rooms[1] && rooms[1].station));
    } else {
      rect(16, 16, 80, 80, stationLabel(rooms[0] && rooms[0].station), !!(rooms[0] && rooms[0].station));
      rect(104, 16, 80, 80, stationLabel(rooms[1] && rooms[1].station), !!(rooms[1] && rooms[1].station));
      rect(16, 104, 80, 80, stationLabel(rooms[2] && rooms[2].station), !!(rooms[2] && rooms[2].station));
      rect(104, 104, 80, 80, stationLabel(rooms[3] && rooms[3].station), !!(rooms[3] && rooms[3].station));
    }
    wrap.append(svg);
    var pre = make("pre", "portrait-ascii", game.portraitLines(state).join("\n"));
    wrap.append(pre);
    var outposts = Object.keys(base.outposts || {});
    if (outposts.length) {
      wrap.append(make("p", "help", "Outposts at " + outposts.map(function (id) {
        var zone = state.wipe.zones[id];
        return zone ? zone.name : id;
      }).join(", ") + "."));
    }
    return wrap;
  }

  function renderMap(view) {
    var map = $("islandMap");
    map.replaceChildren();
    var occupied = {};
    view.map.forEach(function (zone) {
      occupied[zone.col + "," + zone.row] = true;
      var btn = make("button", "ex-zone" + (zone.isHere ? " is-here" : "") + (zone.claimed ? " is-claimed" : ""));
      btn.type = "button";
      btn.style.gridColumn = String(zone.col);
      btn.style.gridRow = String(zone.row);
      btn.append(make("p", "eyebrow", zone.isHere ? "YOU ARE HERE" : zone.claimed ? "CLAIMED" : zone.terrain));
      btn.append(make("h3", "", zone.name));
      var bits = [];
      if (zone.monument) bits.push(zone.monument.name);
      var nodes = nodeLabel(zone.nodes);
      if (nodes) bits.push(nodes);
      btn.append(make("p", "help", bits.join(" · ") || "Quiet ground."));
      var canMove = zone.move.ok;
      var canRecall = zone.recall.ok;
      btn.disabled = !canMove && !canRecall && !zone.isHere;
      btn.title = zone.isHere ? "Current zone" : zone.move.reason || zone.recall.reason || "Travel";
      btn.addEventListener("click", function () {
        if (zone.isHere) return;
        if (canRecall && (!canMove || zone.recall.reason)) act({ type: "recall", zoneId: zone.id });
        else if (canMove) act({ type: "move", zoneId: zone.id });
        else if (canRecall) act({ type: "recall", zoneId: zone.id });
      });
      map.append(btn);
    });
    for (var col = 1; col <= 3; col++) {
      for (var row = 1; row <= 3; row++) {
        if (occupied[col + "," + row]) continue;
        var sea = make("div", "ex-sea", row === 1 ? "Open weather" : "Black water");
        sea.style.gridColumn = String(col);
        sea.style.gridRow = String(row);
        map.append(sea);
      }
    }
  }

  function renderObjective(view) {
    $("objectiveHelp").textContent = view.boat.seen
      ? "Parts in hand, then assemble on Wreck Beach. You choose when to leave."
      : "Walk to Wreck Beach and search the ribs to identify the boat.";
    var track = $("objectiveTrack");
    track.replaceChildren();
    function part(name, have, hint) {
      var item = make("div", "objective-part" + (have ? " is-have" : ""));
      item.append(make("strong", "", have ? "✓ " + name : name));
      item.append(make("p", "help", hint));
      track.append(item);
    }
    part("Pontoon plate", view.boat.parts.pontoon, "Search Train Yard");
    part("Starter coil", view.boat.parts.coil, "Search Military Tunnels");
    part("Fuel kit", view.boat.parts.fuel, "Craft at a claimed site");
    part("Assembled", view.boat.assembled, "Bolt it together on Wreck Beach");
  }

  function renderInventory(view) {
    var box = $("inventory");
    box.replaceChildren();
    game.RESOURCES.forEach(function (key) {
      box.append(chip(key, view.inventory[key]));
    });
    box.append(chip("Pack", view.carried + " / " + view.cap));
    box.append(chip("Hatchet", view.hatchet ? "Yes" : "No"));
    $("kitLine").textContent = view.kits.length
      ? "Kits in pack: " + view.kits.join(", ") + ". Install into an empty room."
      : "No kits waiting. Discover, craft, then install.";
  }

  function addActionButton(parent, label, check, action, className) {
    var btn = make("button", className || "small-button", label);
    btn.type = "button";
    setButton(btn, check);
    btn.addEventListener("click", function () {
      act(action);
    });
    parent.append(btn);
    return btn;
  }

  function renderActions(view) {
    var box = $("actionBox");
    box.replaceChildren();

    var gather = make("div", "action-row");
    gather.append(make("p", "field-label", "Gather"));
    var keys = (view.actions.gather.resources || []).slice();
    if (!keys.length) gather.append(make("p", "help", view.actions.gather.reason || "Nothing to pull here."));
    keys.forEach(function (resource) {
      var check = game.inspectAction(state, { type: "gather", resource: resource });
      addActionButton(gather, "Take " + resource, check, { type: "gather", resource: resource });
    });
    box.append(gather);

    var build = make("div", "action-row");
    build.append(make("p", "field-label", "Build"));
    addActionButton(build, "Drop 1×1", view.actions.build.shack, { type: "build", structure: "shack" });
    addActionButton(build, "Expand 1×2", view.actions.build["expand-1x2"], { type: "build", structure: "expand-1x2" });
    addActionButton(build, "Square 2×2", view.actions.build["expand-2x2"], { type: "build", structure: "expand-2x2" });
    addActionButton(build, "Plant outpost", view.actions.build.outpost, { type: "build", structure: "outpost" });
    box.append(build);

    var craft = make("div", "action-row");
    craft.append(make("p", "field-label", "Craft"));
    view.actions.craft.forEach(function (entry) {
      if (entry.id === "smelt" && view.known.indexOf("furnace") === -1) return;
      if (entry.id === "recycle" && view.known.indexOf("recycler") === -1) return;
      if (!entry.known && entry.id !== "fuel-kit") return;
      var label = entry.name;
      if (entry.id === "smelt") label = "Smelt ore";
      if (entry.id === "recycle") label = "Recycle components";
      if (entry.id === "fuel-kit") label = "Prepare fuel kit";
      addActionButton(craft, label, entry.craft, { type: "craft", recipeId: entry.id });
    });
    if (view.actions.install.ok) {
      addActionButton(craft, "Install " + view.actions.install.kit, view.actions.install, { type: "install" }, "small-button");
    }
    box.append(craft);

    var travel = make("div", "action-row");
    travel.append(make("p", "field-label", "Search & leave"));
    addActionButton(travel, "Recall camp", view.actions.recallCamp, { type: "recall", zoneId: "camp" }, "icon-button");
    addActionButton(travel, "Search here", view.actions.explore, { type: "explore" }, "icon-button");
    addActionButton(travel, "Assemble skiff", view.actions.assemble, { type: "assemble" }, "icon-button");
    addActionButton(travel, "Extract", view.actions.extract, { type: "extract" }, "primary-button");
    addActionButton(travel, "End day", view.actions.endDay, { type: "endDay" }, "icon-button");
    box.append(travel);

    var found = view.revealed.map(function (row) {
      return row.name;
    });
    $("actionHint").textContent =
      view.actionsLeft +
      " actions left today. Discoveries: " +
      (found.length ? found.join(", ") : "none yet") +
      ".";
    var reasons = [];
    if (!view.actions.explore.ok) reasons.push(view.actions.explore.reason);
    if (!view.actions.extract.ok) reasons.push(view.actions.extract.reason);
    $("turnReasons").textContent = view.ended ? view.ended.ending : reasons.filter(Boolean).slice(0, 2).join(" · ");
  }

  function renderLog(view) {
    $("logList").replaceChildren();
    view.log
      .slice()
      .reverse()
      .forEach(function (line) {
        $("logList").append(make("li", "", line));
      });
  }

  function renderEnd(view) {
    var dialog = $("endDialog");
    if (!view.ended) {
      if (dialog.open) dialog.close();
      return;
    }
    $("endTitle").textContent = "Extracted — " + view.ended.layoutName;
    $("endReason").textContent = view.ended.ending + " " + view.ended.contrast;
    $("endPortrait").textContent = view.ended.portrait;
    var meta = $("endMeta");
    meta.replaceChildren();
    meta.append(make("p", "", "Seed " + view.ended.seed + " · Day " + view.ended.days + " · " + view.ended.shape + " home"));
    meta.append(make("p", "", "Route: " + view.ended.route.join(" → ")));
    meta.append(make("p", "", "Discoveries: " + (view.ended.discoveries.join(", ") || "none")));
    meta.append(make("p", "", "Stations: " + (view.ended.stations.join(", ") || "empty rooms")));
    if (!dialog.open) dialog.showModal();
  }

  function render() {
    renderTable();
  }

  function renderTable() {
    var view = game.getView(state);
    setHidden("lobby", true);
    setHidden("table", false);
    $("statusKicker").textContent = "DAY " + view.day + " · " + view.actionsLeft + " ACTIONS";
    $("turnHeading").textContent = view.ended ? "Wipe over" : view.locationName;
    $("statusLine").textContent = view.ended
      ? view.ended.ending
      : view.layoutName + " · " + view.carried + "/" + view.cap + " in the pack";
    $("seedBadge").textContent = "Seed " + view.seed;
    $("layoutHook").textContent = view.hook;
    $("basePortrait").replaceChildren(renderPortrait(view.base));
    renderMap(view);
    renderObjective(view);
    renderInventory(view);
    renderActions(view);
    renderLog(view);
    renderEnd(view);
  }

  function renderLobby() {
    setHidden("table", true);
    setHidden("lobby", false);
    var saved = loadSaved();
    if (saved && saved.ended == null && saved.player) {
      $("resumeHint").hidden = false;
      $("resumeHint").textContent =
        "A wipe is in progress (" +
        (saved.wipe && saved.wipe.layoutName ? saved.wipe.layoutName : "island") +
        ", day " +
        saved.day +
        "). Start this wipe overwrites it.";
    } else {
      $("resumeHint").hidden = true;
    }
    var demos = $("demoSeeds");
    demos.replaceChildren();
    demos.append(make("p", "field-label", "Two seeds, two builds"));
    DEMO.forEach(function (row) {
      var btn = make("button", "small-button demo-seed", row.label);
      btn.type = "button";
      btn.title = row.note + " Seed " + row.seed;
      btn.addEventListener("click", function () {
        $("seedInput").value = row.seed;
        startWipe(row.seed);
      });
      demos.append(btn);
    });
    var memory = loadMemory();
    var box = $("memoryBox");
    if (!memory.length) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    box.hidden = false;
    box.replaceChildren();
    box.append(make("p", "eyebrow", "MEMORY"));
    box.append(make("p", "help", "The island resets. These portraits stay on this browser."));
    memory.slice(0, 4).forEach(function (row) {
      var item = make("div", "memory-item");
      item.append(make("strong", "", row.layoutName + " · " + row.seed));
      item.append(make("p", "help", row.contrast || row.shape));
      box.append(item);
    });
  }

  function showLobby() {
    var url = new URL(window.location.href);
    url.searchParams.set("new", "1");
    window.history.replaceState({}, "", url.pathname + url.search);
    renderLobby();
  }

  function wire() {
    $("startForm").addEventListener("submit", function (event) {
      event.preventDefault();
      startWipe($("seedInput").value.trim());
    });
    $("newWipeBtn").addEventListener("click", showLobby);
    $("endAgain").addEventListener("click", function () {
      $("endDialog").close();
      showLobby();
    });
    $("howBtn").addEventListener("click", function () {
      $("howDialog").showModal();
    });
    document.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        $(button.dataset.close).close();
      });
    });
  }

  function boot() {
    wire();
    var seed = querySeed();
    var saved = loadSaved();
    if (wantsNew()) {
      if (seed) $("seedInput").value = seed;
      renderLobby();
      return;
    }
    if (seed && (!saved || saved.seed !== seed || saved.ended)) {
      startWipe(seed);
      return;
    }
    if (saved && !saved.ended) {
      state = saved;
      renderTable();
      toast("Resumed this wipe.");
      return;
    }
    if (seed) $("seedInput").value = seed;
    renderLobby();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
