(function () {
  "use strict";

  var game = window.WipeExpedition;
  var GAME_KEY = "wipe-table.expedition.game.v1";
  var MEMORY_KEY = "wipe-table.expedition.memory.v1";
  var state = null;
  var toastTimer;
  var DEMO = [
    { seed: "wipe-1", label: "Harbor scrap", note: "Components by Train Yard — stay small, recycle." },
    { seed: "wipe-4", label: "Inland ore", note: "Rich ore on the ridge — furnace at camp, haul inland." },
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

  var MONUMENT_GLYPHS = {
    "train-yard": { src: "art/toe-crane.png", cls: "ex-glyph-crane", label: "Train Yard" },
    "military-tunnels": { src: "art/lattice-spike.png", cls: "ex-glyph-tunnels", label: "Military Tunnels" },
  };

  function monumentGlyph(monumentId, extraClass) {
    var spec = MONUMENT_GLYPHS[monumentId];
    if (!spec) return null;
    var frame = make("span", "ex-glyph " + spec.cls + (extraClass ? " " + extraClass : ""));
    var img = make("img", "ex-glyph-img");
    img.src = spec.src;
    img.alt = spec.label;
    img.decoding = "async";
    img.draggable = false;
    frame.append(img);
    return frame;
  }

  function zoneStamp(zone) {
    var wrap = make("span", "ex-stamp ex-stamp-" + zone.id);
    var html = window.WipeIcons && window.WipeIcons.zoneStamp && window.WipeIcons.zoneStamp(zone.id, zone.name);
    if (html) wrap.innerHTML = html;
    return wrap;
  }

  function svgNode(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function plugTriangle(svg, x, y, dir, size) {
    var pts;
    if (dir === "s") pts = [x, y + size, x - size * 0.92, y, x + size * 0.92, y];
    else if (dir === "n") pts = [x, y - size, x - size * 0.92, y, x + size * 0.92, y];
    else if (dir === "w") pts = [x - size, y, x, y - size * 0.92, x, y + size * 0.92];
    else pts = [x + size, y, x, y - size * 0.92, x, y + size * 0.92];
    svg.appendChild(
      svgNode("polygon", {
        points: pts.join(" "),
        class: "portrait-plug",
        fill: "rgba(72, 74, 70, 0.55)",
        stroke: "rgba(232, 220, 200, 0.72)",
        "stroke-width": "1.4",
        "stroke-dasharray": "3 2",
      })
    );
  }

  function roomSquare(svg, x, y, w, h, label, filled) {
    svg.appendChild(
      svgNode("rect", {
        x: String(x),
        y: String(y),
        width: String(w),
        height: String(h),
        rx: "2",
        ry: "2",
        class: filled ? "portrait-core is-filled" : "portrait-core",
        fill: filled ? "rgba(42, 33, 24, 0.38)" : "rgba(18, 16, 12, 0.12)",
        stroke: filled ? "#d4b46a" : "rgba(232,196,148,0.42)",
        "stroke-width": "2",
      })
    );
    var t = svgNode("text", {
      x: String(x + w / 2),
      y: String(y + h / 2 + 5),
      "text-anchor": "middle",
      fill: "#efe4d2",
      "font-size": "13",
      "font-family": "IBM Plex Sans, sans-serif",
    });
    t.textContent = label;
    svg.appendChild(t);
  }

  function renderPortrait(base) {
    var wrap = make("div", "portrait-wrap");
    var rooms = (base.camp && base.camp.rooms) || [];
    var shape = (base.camp && base.camp.shape) || "none";
    var plate = make("div", "portrait-plate shape-" + shape);
    plate.setAttribute("role", "img");
    plate.setAttribute("aria-label", "Base portrait " + shape);
    plate.dataset.shape = shape;

    if (shape !== "none") {
      var bible = make("img", "portrait-bible");
      bible.src = "art/base-growth-bible.png";
      bible.alt = "";
      bible.decoding = "async";
      bible.setAttribute("aria-hidden", "true");
      plate.append(bible);
    }

    var svg = svgNode("svg", {
      viewBox: "0 0 200 200",
      class: "portrait-svg",
    });

    function room(i) {
      return rooms[i] && rooms[i].station;
    }

    if (shape === "none") {
      roomSquare(svg, 40, 70, 120, 60, "empty beach", false);
    } else if (shape === "1x1") {
      roomSquare(svg, 55, 48, 90, 90, stationLabel(room(0)), !!room(0));
      svg.appendChild(
        svgNode("rect", {
          x: "92",
          y: "128",
          width: "16",
          height: "10",
          class: "portrait-door",
          fill: "#4a3728",
          stroke: "rgba(232,196,148,0.4)",
          "stroke-width": "1",
        })
      );
    } else if (shape === "1x2") {
      roomSquare(svg, 18, 48, 80, 90, stationLabel(room(0)), !!room(0));
      roomSquare(svg, 102, 48, 80, 90, stationLabel(room(1)), !!room(1));
      plugTriangle(svg, 100, 140, "s", 22);
    } else {
      roomSquare(svg, 40, 36, 58, 58, stationLabel(room(0)), !!room(0));
      roomSquare(svg, 102, 36, 58, 58, stationLabel(room(1)), !!room(1));
      roomSquare(svg, 40, 98, 58, 58, stationLabel(room(2)), !!room(2));
      roomSquare(svg, 102, 98, 58, 58, stationLabel(room(3)), !!room(3));
      plugTriangle(svg, 70, 34, "n", 16);
      plugTriangle(svg, 130, 34, "n", 16);
      plugTriangle(svg, 38, 66, "w", 16);
      plugTriangle(svg, 38, 126, "w", 16);
      plugTriangle(svg, 162, 66, "e", 16);
      plugTriangle(svg, 162, 126, "e", 16);
      plugTriangle(svg, 70, 158, "s", 16);
      plugTriangle(svg, 100, 158, "s", 18);
      plugTriangle(svg, 130, 158, "s", 16);
    }
    plate.append(svg);
    wrap.append(plate);
    if (shape === "none") {
      wrap.append(make("pre", "portrait-ascii", game.portraitLines(state).join("\n")));
    }
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
    var hereZone = null;
    view.map.forEach(function (zone) {
      if (zone.isHere) hereZone = zone;
    });

    var chrome = make("img", "ex-map-chrome");
    chrome.src = "art/island-twin-lobes.png";
    chrome.alt = "";
    chrome.decoding = "async";
    chrome.setAttribute("aria-hidden", "true");
    chrome.style.gridColumn = "1 / -1";
    chrome.style.gridRow = "1 / -1";
    map.append(chrome);

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ex-paths");
    svg.setAttribute("viewBox", "0 0 3 3");
    svg.setAttribute("aria-hidden", "true");
    svg.style.gridColumn = "1 / -1";
    svg.style.gridRow = "1 / -1";

    view.map.forEach(function (zone) {
      occupied[zone.col + "," + zone.row] = true;
      var canMove = zone.move.ok;
      var canRecall = zone.recall.ok;
      var both = canMove && canRecall;
      var distant = !zone.isHere && !canMove && !canRecall;
      var chromeOnly = distant && !zone.claimed;
      var iconTile = zone.isHere || canMove;
      var fastTravel = canMove && !zone.adjacent;
      var clickable = (canMove || canRecall) && !both && !zone.isHere;
      var cls = "ex-zone";
      if (zone.isHere) cls += " is-here";
      if (zone.claimed) cls += " is-claimed";
      if (canMove) cls += " is-walkable";
      if (canRecall && !canMove) cls += " is-recallable";
      if (chromeOnly) cls += " is-distant is-chrome";
      else if (distant) cls += " is-distant is-solid";
      if (iconTile) cls += " is-icon";
      if (zone.monument) cls += " has-monument";

      var cell = make(clickable ? "button" : "div", cls);
      if (cell.tagName === "BUTTON") cell.type = "button";
      cell.style.gridColumn = String(zone.col);
      cell.style.gridRow = String(zone.row);
      cell.dataset.zone = zone.id;
      if (zone.monument) cell.dataset.monument = zone.monument.id;
      cell.setAttribute("aria-label", zone.isHere ? zone.name + ", you are here" : zone.name);

      if (zone.isHere) {
        var hereMark = make("span", "ex-here-banner", "HERE");
        hereMark.setAttribute("aria-hidden", "true");
        cell.append(hereMark);
      }

      if (iconTile) cell.append(zoneStamp(zone));

      var titleRow = make("div", "ex-zone-title");
      titleRow.append(make("p", "ex-zone-caption", zone.name));
      var hasGlyph = false;
      if (zone.monument) {
        var glyph = monumentGlyph(zone.monument.id, "ex-glyph-map");
        if (glyph) {
          titleRow.append(glyph);
          hasGlyph = true;
        }
      }
      cell.append(titleRow);
      var bits = [];
      if (zone.monument && !hasGlyph) bits.push(zone.monument.name);
      if (!chromeOnly && !iconTile) {
        var nodes = nodeLabel(zone.nodes);
        if (nodes) bits.push(nodes);
      }
      if (bits.length) cell.append(make("p", "help", bits.join(" · ")));

      var chips = make("div", "ex-chips");
      if (zone.claimed && !zone.isHere) chips.append(make("span", "ex-chip ex-chip-claimed", "Claimed"));
      if (canRecall && !canMove) chips.append(make("span", "ex-chip ex-chip-recall", "Recall"));
      if (chips.childNodes.length) cell.append(chips);

      if (chromeOnly) {
        cell.tabIndex = 0;
      }

      if (both) {
        var actions = make("div", "ex-zone-actions");
        addActionButton(actions, "Walk", zone.move, { type: "move", zoneId: zone.id }, "small-button");
        addActionButton(actions, "Recall", zone.recall, { type: "recall", zoneId: zone.id }, "small-button");
        cell.append(actions);
      } else if (clickable) {
        if (canMove) cell.title = (fastTravel ? "Fast travel to " : "Walk to ") + zone.name;
        else cell.title = "Recall to " + zone.name;
        cell.addEventListener("click", function () {
          if (canMove) act({ type: "move", zoneId: zone.id });
          else if (canRecall) act({ type: "recall", zoneId: zone.id });
        });
      }

      if (hereZone && canMove && zone.adjacent) {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(hereZone.col - 0.5));
        line.setAttribute("y1", String(hereZone.row - 0.5));
        line.setAttribute("x2", String(zone.col - 0.5));
        line.setAttribute("y2", String(zone.row - 0.5));
        line.setAttribute("class", "ex-path-line");
        svg.appendChild(line);
      }
      map.append(cell);
    });

    for (var col = 1; col <= 3; col++) {
      for (var row = 1; row <= 3; row++) {
        if (occupied[col + "," + row]) continue;
        var sea = make("div", "ex-sea");
        sea.style.gridColumn = String(col);
        sea.style.gridRow = String(row);
        sea.setAttribute("aria-hidden", "true");
        map.append(sea);
      }
    }
    map.append(svg);
    if (
      view.map.some(function (zone) {
        return zone.move.ok && zone.adjacent;
      })
    ) {
      map.classList.add("has-walkable");
    } else {
      map.classList.remove("has-walkable");
    }
  }

  function renderObjective(view) {
    $("objectiveHelp").textContent = view.boat.seen
      ? view.boat.status
      : "Walk to Wreck Beach and search the ribs to identify the boat.";
    var track = $("objectiveTrack");
    track.replaceChildren();
    function pip(name, have, hint) {
      var item = make("span", "skiff-pip" + (have ? " is-have" : ""));
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-label", name + (have ? ", have" : ", missing"));
      item.title = have ? name + " — have" : name + " — " + hint;
      item.append(make("span", "skiff-pip-dot", have ? "✓" : ""));
      item.append(make("span", "skiff-pip-name", name));
      track.append(item);
    }
    pip("Pontoon plate", view.boat.parts.pontoon, "Search Train Yard");
    pip("Starter coil", view.boat.parts.coil, "Search Military Tunnels");
    pip("Fuel kit", view.boat.parts.fuel, "Craft at a claimed site");
    pip("Assembled", view.boat.assembled, "Bolt it together on Wreck Beach");
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

    var legal = [];
    var blocked = [];
    var here = view.map.filter(function (zone) {
      return zone.isHere;
    })[0];

    function queue(label, check, action, className, decorate) {
      var item = {
        label: label,
        check: check || { ok: false, reason: "Unavailable." },
        action: action,
        className: className,
        decorate: decorate,
      };
      if (item.check.ok) legal.push(item);
      else blocked.push(item);
    }

    var keys = (view.actions.gather.resources || []).slice();
    if (!keys.length) {
      queue("Gather", view.actions.gather, { type: "gather" });
    } else {
      keys.forEach(function (resource) {
        queue(
          "Take " + resource,
          game.inspectAction(state, { type: "gather", resource: resource }),
          { type: "gather", resource: resource }
        );
      });
    }

    if (view.base.camp.shape === "none") {
      queue(
        "Drop 1×1",
        view.actions.build.shack,
        { type: "build", structure: "shack" },
        view.actions.build.shack.ok ? "primary-button" : "small-button"
      );
    }
    if (view.showExpand["expand-1x2"]) {
      queue("Expand 1×2", view.actions.build["expand-1x2"], { type: "build", structure: "expand-1x2" });
    }
    if (view.showExpand["expand-2x2"]) {
      queue("Square 2×2", view.actions.build["expand-2x2"], { type: "build", structure: "expand-2x2" });
    }
    if (view.base.camp.shape !== "none" && view.location !== "camp") {
      queue("Plant outpost", view.actions.build.outpost, { type: "build", structure: "outpost" });
    }

    view.actions.craft.forEach(function (entry) {
      if (entry.id === "smelt" && view.known.indexOf("furnace") === -1) return;
      if (entry.id === "recycle" && view.known.indexOf("recycler") === -1) return;
      if (!entry.known && entry.id !== "fuel-kit") return;
      var label = entry.name;
      if (entry.id === "smelt") label = "Smelt ore";
      if (entry.id === "recycle") label = "Recycle components";
      if (entry.id === "fuel-kit") label = "Prepare fuel kit";
      queue(label, entry.craft, { type: "craft", recipeId: entry.id });
    });
    if (view.kits.length) {
      var installLabel = view.actions.install.kit ? "Install " + view.actions.install.kit : "Install kit";
      queue(installLabel, view.actions.install, { type: "install" });
    }

    var searchLabel = "Search here";
    if (view.location === "wreck" && !view.boat.seen) searchLabel = "Identify wreck";
    else if (here && here.monument) searchLabel = "Search " + here.monument.name;
    queue("Recall camp", view.actions.recallCamp, { type: "recall", zoneId: "camp" }, "icon-button");
    queue(searchLabel, view.actions.explore, { type: "explore" }, "icon-button", function (btn) {
      if (here && here.monument) {
        var searchGlyph = monumentGlyph(here.monument.id, "ex-glyph-btn");
        if (searchGlyph) btn.prepend(searchGlyph);
      }
    });
    queue("Assemble skiff", view.actions.assemble, { type: "assemble" }, "icon-button");
    queue(
      "Extract",
      view.actions.extract,
      { type: "extract" },
      view.extractPrimary && view.actions.extract.ok ? "primary-button" : "icon-button"
    );
    queue("End day", view.actions.endDay, { type: "endDay" }, "icon-button");

    var now = make("div", "action-row action-now");
    now.append(make("p", "field-label", "Available now"));
    if (!legal.length) {
      now.append(make("p", "help", view.ended ? view.ended.ending : "Nothing legal this beat."));
    } else {
      legal.forEach(function (item) {
        var btn = addActionButton(now, item.label, item.check, item.action, item.className);
        if (item.decorate) item.decorate(btn);
      });
    }
    box.append(now);

    if (blocked.length) {
      var why = make("details", "why-not");
      why.append(make("summary", "", "Why not"));
      var list = make("ul", "why-not-list");
      blocked.forEach(function (item) {
        var row = make("li", "why-not-row");
        row.append(make("strong", "", item.label));
        row.append(document.createTextNode(" — "));
        row.append(make("span", "why-not-reason", item.check.reason || "Unavailable."));
        list.append(row);
      });
      why.append(list);
      box.append(why);
    }

    $("actionHint").textContent =
      view.nextHint +
      " · " +
      view.actionsLeft +
      " actions left today.";
    $("turnReasons").textContent = view.ended ? view.ended.ending : view.nextHint;
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
      : view.nextHint;
    $("seedBadge").textContent = "Seed " + view.seed;
    $("layoutHook").textContent = view.hook;
    $("basePortrait").dataset.shape = view.base.camp.shape || "none";
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
