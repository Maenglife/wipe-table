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

  function kitName(id) {
    return (game.BLUEPRINTS[id] && game.BLUEPRINTS[id].name) || id;
  }

  function invChip(key, value, label, extraClass) {
    var chipEl = make("span", "inv-chip" + (Number(value) === 0 ? " is-zero" : "") + (extraClass ? " " + extraClass : ""));
    var markHtml =
      window.WipeIcons && window.WipeIcons.resourceMark && window.WipeIcons.resourceMark(key, label || key);
    if (!markHtml && window.WipeIcons && window.WipeIcons.ICONS && window.WipeIcons.ICONS[key]) {
      markHtml = window.WipeIcons.ICONS[key](label || key);
    }
    if (markHtml) {
      var icon = make("span", "inv-icon");
      icon.innerHTML = markHtml;
      chipEl.append(icon);
    }
    chipEl.append(make("span", "inv-count", String(value)));
    chipEl.title = (label || key) + ": " + value;
    chipEl.setAttribute("aria-label", (label || key) + " " + value);
    return chipEl;
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

  function roomSquare(svg, x, y, w, h, label, filled, onAct) {
    var cls = filled ? "portrait-core is-filled" : "portrait-core";
    if (onAct) cls += " is-act";
    var rect = svgNode("rect", {
      x: String(x),
      y: String(y),
      width: String(w),
      height: String(h),
      rx: "2",
      ry: "2",
      class: cls,
      fill: filled ? "rgba(42, 33, 24, 0.38)" : "rgba(18, 16, 12, 0.12)",
      stroke: filled ? "#d4b46a" : "rgba(232,196,148,0.42)",
      "stroke-width": "2",
    });
    svg.appendChild(rect);
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
    if (onAct) {
      rect.addEventListener("click", onAct);
      t.addEventListener("click", onAct);
      t.style.cursor = "pointer";
    }
  }

  function renderPortrait(view) {
    var base = view.base;
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

    function roomAct(i, station) {
      if (view.ended || view.location !== "camp") return null;
      if (!station && view.actions.install.ok) {
        return function () {
          act({ type: "install", roomIndex: i });
        };
      }
      if (station === "furnace") {
        var smelt = game.inspectAction(state, { type: "craft", recipeId: "smelt" });
        if (smelt.ok) {
          return function () {
            act({ type: "craft", recipeId: "smelt" });
          };
        }
      }
      if (station === "recycler") {
        var recycle = game.inspectAction(state, { type: "craft", recipeId: "recycle" });
        if (recycle.ok) {
          return function () {
            act({ type: "craft", recipeId: "recycle" });
          };
        }
      }
      return null;
    }

    if (shape === "none") {
      roomSquare(svg, 40, 70, 120, 60, "empty beach", false);
    } else if (shape === "1x1") {
      roomSquare(svg, 55, 48, 90, 90, stationLabel(room(0)), !!room(0), roomAct(0, room(0)));
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
      roomSquare(svg, 18, 48, 80, 90, stationLabel(room(0)), !!room(0), roomAct(0, room(0)));
      roomSquare(svg, 102, 48, 80, 90, stationLabel(room(1)), !!room(1), roomAct(1, room(1)));
      plugTriangle(svg, 100, 140, "s", 22);
    } else {
      roomSquare(svg, 40, 36, 58, 58, stationLabel(room(0)), !!room(0), roomAct(0, room(0)));
      roomSquare(svg, 102, 36, 58, 58, stationLabel(room(1)), !!room(1), roomAct(1, room(1)));
      roomSquare(svg, 40, 98, 58, 58, stationLabel(room(2)), !!room(2), roomAct(2, room(2)));
      roomSquare(svg, 102, 98, 58, 58, stationLabel(room(3)), !!room(3), roomAct(3, room(3)));
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
    var outposts = Object.keys(base.outposts || {});
    if (outposts.length) {
      wrap.append(make("p", "help", "Outposts at " + outposts.map(function (id) {
        var zone = state.wipe.zones[id];
        return zone ? zone.name : id;
      }).join(", ") + "."));
    }
    return wrap;
  }

  function craftRank(id) {
    if (id === "fuel-kit") return 0;
    if (id === "smelt") return 1;
    if (id === "recycle") return 2;
    if (id === "sleeping-bag" || id === "stone-hatchet") return 8;
    return 3;
  }

  function hereActs(view, zone) {
    var acts = [];
    var reason = "";
    if (!zone.isHere || view.ended) {
      return { acts: acts, reason: view.ended ? (view.ended.ending || "") : "" };
    }

    function add(label, check, action, className, decorate) {
      if (check && check.ok) {
        acts.push({
          label: label,
          check: check,
          action: action,
          className: className,
          decorate: decorate,
        });
      }
    }

    if (zone.id === "camp" && view.base.camp.shape === "none") {
      add(
        "Drop 1×1",
        view.actions.build.shack,
        { type: "build", structure: "shack" },
        view.actions.build.shack.ok ? "primary-button" : "small-button"
      );
      if (!view.actions.build.shack.ok) reason = view.actions.build.shack.reason;
    }

    if (zone.id === "wreck") {
      if (view.actions.assemble.ok) {
        add("Assemble", view.actions.assemble, { type: "assemble" }, "primary-button");
      } else if (view.boat.seen && !view.actions.extract.ok) {
        reason = view.actions.assemble.reason || view.actions.extract.reason;
      }
    }

    if (view.actions.explore.ok) {
      var searchLabel = "Search";
      if (zone.id === "wreck" && !view.boat.seen) searchLabel = "Identify wreck";
      else if (zone.id === "wreck") searchLabel = "Search wreck";
      add(searchLabel, view.actions.explore, { type: "explore" });
    }

    if (view.actions.install.ok) {
      add("Install " + kitName(view.actions.install.kit), view.actions.install, { type: "install" });
    }

    var crafts = [];
    view.actions.craft.forEach(function (entry) {
      if (entry.id === "smelt" && view.known.indexOf("furnace") === -1) return;
      if (entry.id === "recycle" && view.known.indexOf("recycler") === -1) return;
      if (!entry.known && entry.id !== "fuel-kit") return;
      if (!entry.craft || !entry.craft.ok) return;
      var label = entry.name;
      if (entry.id === "smelt") label = "Smelt ore";
      if (entry.id === "recycle") label = "Recycle";
      if (entry.id === "fuel-kit") label = "Prepare fuel";
      crafts.push({
        rank: craftRank(entry.id),
        label: label,
        check: entry.craft,
        action: { type: "craft", recipeId: entry.id },
      });
    });
    crafts.sort(function (a, b) {
      return a.rank - b.rank;
    });
    crafts.forEach(function (row) {
      add(row.label, row.check, row.action);
    });

    if (view.base.camp.shape !== "none" && zone.id !== "camp" && zone.buildable) {
      add("Plant outpost", view.actions.build.outpost, { type: "build", structure: "outpost" });
    }

    var keys = (view.actions.gather.resources || []).slice();
    if (view.actions.gather.ok && keys.length) {
      keys.forEach(function (resource) {
        var check = game.inspectAction(state, { type: "gather", resource: resource });
        add("Take " + resource, check, { type: "gather", resource: resource });
      });
    } else if (!view.actions.gather.ok && keys.length && !reason) {
      reason = view.actions.gather.reason;
    }

    if (acts.length > 3) acts = acts.slice(0, 3);
    return { acts: acts, reason: reason };
  }

  function activateZone(zone) {
    if (zone.isHere) return;
    if (zone.move.ok && zone.adjacent) {
      act({ type: "move", zoneId: zone.id });
      return;
    }
    if (zone.recall.ok) {
      act({ type: "recall", zoneId: zone.id });
      return;
    }
    if (zone.move.ok) {
      act({ type: "move", zoneId: zone.id });
    }
  }

  function armZone(cell, zone) {
    var walkable = zone.move.ok;
    var recallable = zone.recall.ok;
    var chromeOnly = !zone.isHere && !walkable && !recallable && !zone.claimed && zone.id !== "wreck";
    cell.tabIndex = 0;
    if (chromeOnly) return;
    cell.addEventListener("click", function (event) {
      if (event.target.closest("button")) return;
      activateZone(zone);
    });
    cell.addEventListener("keydown", function (event) {
      if (event.target !== cell) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (zone.isHere) {
        var first = cell.querySelector(".ex-tile-acts button, .ex-skiff.is-ready");
        if (first) first.focus();
        return;
      }
      activateZone(zone);
    });
  }

  function skiffMiniPips(view) {
    var row = make("div", "ex-skiff-pips");
    [
      ["pontoon", "Pontoon plate"],
      ["coil", "Starter coil"],
      ["fuel", "Fuel kit"],
      ["assembled", "Assembled"],
    ].forEach(function (pair) {
      var have = pair[0] === "assembled" ? view.boat.assembled : view.boat.parts[pair[0]];
      var pip = make("span", "ex-skiff-pip" + (have ? " is-have" : ""));
      pip.title = pair[1] + (have ? " — have" : " — missing");
      pip.setAttribute("aria-label", pair[1] + (have ? ", have" : ", missing"));
      row.append(pip);
    });
    return row;
  }

  function renderWreckSkiff(cell, view, zone) {
    var ready = zone.isHere && view.actions.extract.ok;
    var skiff = make(ready ? "button" : "div", "ex-skiff" + (ready ? " is-ready" : ""));
    if (ready) {
      skiff.type = "button";
      skiff.setAttribute("aria-label", "Extract on the assembled skiff");
      skiff.addEventListener("click", function (event) {
        event.stopPropagation();
        act({ type: "extract" });
      });
    } else {
      skiff.setAttribute("aria-label", "Extraction skiff");
    }
    skiff.append(skiffMiniPips(view));
    skiff.append(zoneStamp(zone));
    if (ready) {
      skiff.append(make("span", "ex-skiff-extract primary-button", "Extract"));
    }
    cell.append(skiff);
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
      var distant = !zone.isHere && !canMove && !canRecall;
      var chromeOnly = distant && !zone.claimed && zone.id !== "wreck";
      var iconTile = zone.isHere || canMove || canRecall || zone.id === "wreck";
      var fastTravel = canMove && !zone.adjacent;
      var cls = "ex-zone";
      if (zone.isHere) cls += " is-here is-selected";
      if (zone.claimed) cls += " is-claimed";
      if (canMove) cls += " is-walkable";
      if (canRecall && !canMove) cls += " is-recallable";
      if (chromeOnly) cls += " is-distant is-chrome";
      else if (distant) cls += " is-distant is-solid";
      if (iconTile) cls += " is-icon";
      if (zone.monument) cls += " has-monument";
      if (zone.id === "wreck") cls += " has-skiff";

      var cell = make("div", cls);
      cell.style.gridColumn = String(zone.col);
      cell.style.gridRow = String(zone.row);
      cell.dataset.zone = zone.id;
      if (zone.monument) cell.dataset.monument = zone.monument.id;
      if (zone.isHere) {
        cell.setAttribute("role", "group");
        cell.setAttribute("aria-current", "location");
        cell.setAttribute("aria-label", zone.name + ", you are here");
      } else if (canMove && zone.adjacent) {
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", "Walk to " + zone.name);
        cell.title = (fastTravel ? "Fast travel to " : "Walk to ") + zone.name;
      } else if (canRecall && !zone.adjacent) {
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", "Recall to " + zone.name);
        cell.title = "Recall to " + zone.name;
      } else if (canMove) {
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", (fastTravel ? "Fast travel to " : "Walk to ") + zone.name);
        cell.title = (fastTravel ? "Fast travel to " : "Walk to ") + zone.name;
      } else {
        cell.setAttribute("aria-label", zone.name);
      }

      if (zone.isHere) {
        var hereMark = make("span", "ex-here-banner", "HERE");
        hereMark.setAttribute("aria-hidden", "true");
        cell.append(hereMark);
      }

      if (zone.id === "wreck") {
        renderWreckSkiff(cell, view, zone);
      } else if (iconTile) {
        cell.append(zoneStamp(zone));
      }

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
      if (chips.childNodes.length) cell.append(chips);

      if (zone.isHere) {
        var board = hereActs(view, zone);
        if (board.acts.length) {
          var tileActs = make("div", "ex-tile-acts");
          board.acts.forEach(function (item) {
            var btn = addActionButton(tileActs, item.label, item.check, item.action, item.className);
            if (item.decorate) item.decorate(btn);
          });
          cell.append(tileActs);
        }
        if (board.reason) cell.append(make("p", "ex-tile-reason", board.reason));
      } else if (canRecall && !zone.adjacent) {
        var recallActs = make("div", "ex-tile-acts");
        addActionButton(recallActs, "Recall", zone.recall, { type: "recall", zoneId: zone.id }, "small-button");
        cell.append(recallActs);
      }

      armZone(cell, zone);

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
      : "Skiff on Wreck Beach — walk there to identify it.";
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
      var amount = view.inventory[key];
      if (!amount) return;
      box.append(invChip(key, amount, key));
    });
    box.append(invChip("pack", view.carried + "/" + view.cap, "Pack"));
    if (view.hatchet) box.append(invChip("hatchet", 1, "Hatchet", "is-tool"));
    view.kits.forEach(function (id) {
      var bp = game.BLUEPRINTS[id];
      box.append(invChip(bp && bp.icon ? bp.icon : "crate", 1, kitName(id), "is-kit"));
    });
  }

  function addActionButton(parent, label, check, action, className) {
    var btn = make("button", className || "small-button", label);
    btn.type = "button";
    setButton(btn, check);
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      act(action);
    });
    parent.append(btn);
    return btn;
  }

  function renderGrow(view) {
    var box = $("growBox");
    box.replaceChildren();
    if (view.ended || view.location !== "camp") return;
    if (!view.showExpand["expand-1x2"] && !view.showExpand["expand-2x2"]) return;
    var details = make("details", "grow-base");
    details.append(make("summary", "", "Grow"));
    var row = make("div", "grow-base-actions");
    if (view.showExpand["expand-1x2"]) {
      addActionButton(row, "Expand 1×2", view.actions.build["expand-1x2"], { type: "build", structure: "expand-1x2" });
    }
    if (view.showExpand["expand-2x2"]) {
      addActionButton(row, "Square 2×2", view.actions.build["expand-2x2"], { type: "build", structure: "expand-2x2" });
    }
    details.append(row);
    box.append(details);
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
    $("basePortrait").replaceChildren(renderPortrait(view));
    renderMap(view);
    renderObjective(view);
    renderInventory(view);
    renderGrow(view);
    setButton($("endDayBtn"), view.actions.endDay);
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
    $("endDayBtn").addEventListener("click", function () {
      act({ type: "endDay" });
    });
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
