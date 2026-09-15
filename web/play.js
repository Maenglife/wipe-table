(function () {
  "use strict";

  var game = window.WipeGame;
  var icons = window.WipeIcons;
  var GAME_KEY = "wipe-table.play.game.v1";
  var PENDING_KEY = "wipe-table.pending-wipe.v1";
  var state = null;
  var pendingWipe = null;
  var gatherPick = [];
  var toastTimer;

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

  function colorFor(setName) {
    if (setName === "Survival") return "var(--survival)";
    if (setName === "Monuments") return "var(--monuments)";
    return "var(--events)";
  }

  function loadJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      toast("This browser can't save right now.");
      return false;
    }
  }

  function persist() {
    if (!state) return;
    try {
      localStorage.setItem(GAME_KEY, game.serialize(state));
    } catch (_) {
      toast("This browser can't save the match.");
    }
  }

  function loadSavedGame() {
    try {
      var raw = localStorage.getItem(GAME_KEY);
      return raw ? game.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loadPending() {
    var data = loadJSON(PENDING_KEY);
    if (!data || !Array.isArray(data.wipe) || !data.wipe.length) return null;
    return data;
  }

  function setHidden(id, hidden) {
    $(id).hidden = hidden;
  }

  function wantsNew() {
    return new URLSearchParams(window.location.search).get("new") === "1";
  }

  function clearNewQuery() {
    if (!wantsNew()) return;
    var url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function showLobby(opts) {
    opts = opts || {};
    setHidden("missingWipe", true);
    setHidden("table", true);
    setHidden("lobby", false);
    $("lobbyError").hidden = true;
    var names = state ? [state.players[0].name, state.players[1].name] : ["", ""];
    $("nameOne").value = names[0] === "Player 1" ? "" : names[0];
    $("nameTwo").value = names[1] === "Player 2" ? "" : names[1];
    var wipe = (pendingWipe && pendingWipe.wipe) || (state && state.wipe) || [];
    $("lobbyWipe").replaceChildren();
    wipe.forEach(function (card) {
      $("lobbyWipe").append(make("span", "", card.name + " (" + card.cost + ")"));
    });
    $("lobbyCopy").textContent = wipe.length
      ? wipe.length + " cards on the island. Pass the browser after each turn."
      : "Pass the browser. Names are optional.";
    if (opts.resume && state && state.phase !== "over") {
      $("resumeHint").hidden = false;
      $("resumeHint").textContent = "A match is already in progress. Start match overwrites it, or open Play without ?new=1 to resume.";
    } else {
      $("resumeHint").hidden = true;
    }
  }

  function showMissing() {
    setHidden("lobby", true);
    setHidden("table", true);
    setHidden("missingWipe", false);
  }

  function chip(label, value) {
    var span = make("span", "stat-chip");
    span.append(make("em", "", label), document.createTextNode(String(value)));
    return span;
  }

  function listCards(cards, emptyText) {
    var wrap = make("div", "mini-cards");
    if (!cards.length) {
      wrap.append(make("p", "help", emptyText));
      return wrap;
    }
    cards.forEach(function (card) {
      var item = make("span", "mini-card", card.name);
      item.title = card.types_summary + " · cost " + card.cost;
      wrap.append(item);
    });
    return wrap;
  }

  function renderPlayers(view) {
    $("playersRow").replaceChildren();
    view.players.forEach(function (player) {
      var article = make("article", "player-mat" + (player.isCurrent ? " is-current" : ""));
      article.append(make("p", "eyebrow", player.isCurrent ? "CURRENT" : "WAITING"));
      article.append(make("h2", "", player.name));
      var stats = make("div", "player-stats");
      stats.append(chip("Wood", player.wood));
      stats.append(chip("Stone", player.stone));
      stats.append(chip("Cloth", player.cloth));
      stats.append(chip("Scrap", player.scrap));
      stats.append(chip("Damage", player.damage + " / 3"));
      stats.append(chip("Raid token", player.raidToken ? "Ready" : "Spent"));
      article.append(stats);
      article.append(make("p", "help", "Raid " + player.raidPower + " · Defense " + player.defense + " · Buildings " + player.buildings));
      article.append(make("h3", "", "Blueprints"));
      article.append(listCards(player.blueprints, "No blueprints yet."));
      article.append(make("h3", "", "Base"));
      article.append(listCards(player.base, "Naked base."));
      $("playersRow").append(article);
    });
  }

  function reasonText(check) {
    return check && !check.ok ? check.reason : "";
  }

  function setButton(button, check, extraDisable) {
    var disabled = extraDisable || !check.ok;
    button.disabled = disabled;
    button.title = disabled ? check.reason || extraDisable || "Unavailable." : "";
    button.setAttribute("aria-disabled", String(disabled));
  }

  function renderIsland(view) {
    $("island").replaceChildren();
    view.actions.cards.forEach(function (entry) {
      var card = entry.card;
      var wrap = make("article", "play-card");
      wrap.style.setProperty("--set-color", colorFor(card.set));
      var art = make("div", "play-card-art");
      if (icons && icons.cardIcon) art.innerHTML = icons.cardIcon(card);
      art.append(make("span", "card-cost", String(card.cost)));
      wrap.append(art);
      wrap.append(make("h3", "", card.name));
      wrap.append(make("p", "card-meta", card.set + " · " + card.types_summary));
      var actions = make("div", "play-card-actions");
      var unlock = make("button", "small-button", "Unlock");
      var craft = make("button", "small-button", "Craft onto base");
      setButton(unlock, entry.unlock);
      setButton(craft, entry.craft);
      var why = make("p", "action-reason", "");
      if (view.phase === "craft" || view.phase === "over") {
        why.textContent = [reasonText(entry.unlock) && "Unlock: " + entry.unlock.reason, reasonText(entry.craft) && "Craft: " + entry.craft.reason].filter(Boolean).join(" ");
      }
      unlock.addEventListener("click", function () {
        act({ type: "unlock", cardId: card.id });
      });
      craft.addEventListener("click", function () {
        act({ type: "craft", cardId: card.id });
      });
      actions.append(unlock, craft);
      wrap.append(actions, why);
      $("island").append(wrap);
    });
  }

  function renderGather(view) {
    var box = $("gatherBox");
    var allowed = view.actions.gather.ok;
    box.classList.toggle("is-disabled", !allowed);
    $("gatherPicks").replaceChildren();
    if (!gatherPick.length) $("gatherPicks").append(make("span", "help", "Pick two: same resource is allowed."));
    gatherPick.forEach(function (res, index) {
      var btn = make("button", "gather-chip", res);
      btn.type = "button";
      btn.addEventListener("click", function () {
        gatherPick.splice(index, 1);
        render();
      });
      $("gatherPicks").append(btn);
    });
    box.querySelectorAll("[data-res]").forEach(function (button) {
      button.disabled = !allowed || gatherPick.length >= 2;
    });
    box.querySelectorAll("[data-preset]").forEach(function (button) {
      button.disabled = !allowed;
    });
    $("gatherUndo").disabled = !allowed || !gatherPick.length;
    var confirm = $("gatherConfirm");
    var gatherCheck = gatherPick.length === 2 ? game.inspectAction(state, { type: "gather", resources: gatherPick }) : { ok: false, reason: allowed ? "Pick exactly 2 resources." : view.actions.gather.reason };
    setButton(confirm, gatherCheck);
    $("gatherReason").textContent = reasonText(gatherCheck);
  }

  function renderActions(view) {
    setButton($("skipCraftBtn"), view.actions.skipCraft);
    setButton($("raidBtn"), view.actions.raid);
    setButton($("skipRaidBtn"), view.actions.skipRaid);
    setButton($("endTurnBtn"), view.actions.endTurn);
    $("raidBtn").textContent = "Raid " + view.raidPreview.target + " (" + view.raidPreview.power + " vs " + view.raidPreview.defense + ")";
    var bits = [];
    if (!view.actions.skipCraft.ok) bits.push("Skip craft — " + view.actions.skipCraft.reason);
    if (!view.actions.raid.ok) bits.push("Raid — " + view.actions.raid.reason);
    if (!view.actions.skipRaid.ok) bits.push("Skip raid — " + view.actions.skipRaid.reason);
    if (!view.actions.endTurn.ok) bits.push("End turn — " + view.actions.endTurn.reason);
    $("turnReasons").textContent = view.winner ? view.winner.reason : bits.join(" · ");
    var hint = {
      gather: "Pick 2 of wood / stone / cloth, then confirm.",
      craft: "Unlock a blueprint, craft onto your base, or skip craft.",
      raid: "Spend your raid token on the other player, or skip raid.",
      end: "Pass the browser after End turn.",
      over: "This wipe is finished.",
    };
    $("actionHint").textContent = hint[view.phase] || "";
  }

  function renderLog(view) {
    $("logList").replaceChildren();
    view.log.slice().reverse().forEach(function (line) {
      $("logList").append(make("li", "", line));
    });
  }

  function renderWinner(view) {
    var dialog = $("winnerDialog");
    if (!view.winner) {
      if (dialog.open) dialog.close();
      return;
    }
    $("winnerTitle").textContent = view.winner.draw ? "Draw" : view.winner.name + " wins";
    $("winnerReason").textContent = view.winner.reason;
    if (!dialog.open) dialog.showModal();
  }

  function render() {
    if (!state) return;
    var view = game.getView(state);
    setHidden("lobby", true);
    setHidden("missingWipe", true);
    setHidden("table", false);
    $("statusKicker").textContent = "ROUND " + view.round + " / " + view.maxRounds;
    $("turnHeading").textContent = view.winner
      ? view.winner.draw
        ? "Wipe over — draw"
        : "Wipe over — " + view.winner.name
      : view.players[view.currentPlayer].name + " — " + view.phaseLabel;
    $("statusLine").textContent = view.winner
      ? view.winner.reason
      : "Phase " + view.phaseLabel + " · " + view.players[view.currentPlayer].name + "'s turn";
    $("seedBadge").textContent = view.seed ? "Seed " + view.seed : "Hotseat";
    if (view.phase !== "gather") gatherPick = [];
    renderPlayers(view);
    renderIsland(view);
    renderGather(view);
    renderActions(view);
    renderLog(view);
    renderWinner(view);
  }

  function act(action) {
    if (!state) return;
    try {
      state = game.applyAction(state, action);
      persist();
      render();
    } catch (error) {
      toast(error.message || "That action isn't legal.");
    }
  }

  function startMatch(event) {
    event.preventDefault();
    var source = pendingWipe || (state && { wipe: state.wipe, seed: state.seed, setCounts: state.setCounts, meta: state.meta });
    if (!source || !source.wipe) {
      $("lobbyError").hidden = false;
      $("lobbyError").textContent = "Generate a wipe in the builder, then choose Play this wipe.";
      return;
    }
    try {
      state = game.createGame({
        wipe: source.wipe,
        names: [$("nameOne").value, $("nameTwo").value],
        seed: source.seed,
        setCounts: source.setCounts,
        meta: source.meta,
      });
      persist();
      saveJSON(PENDING_KEY, source);
      clearNewQuery();
      gatherPick = [];
      render();
    } catch (error) {
      $("lobbyError").hidden = false;
      $("lobbyError").textContent = error.message || "Could not start Play.";
    }
  }

  function wire() {
    $("startForm").addEventListener("submit", startMatch);
    $("gatherBox").addEventListener("click", function (event) {
      var res = event.target.getAttribute("data-res");
      var preset = event.target.getAttribute("data-preset");
      if (res && gatherPick.length < 2) {
        gatherPick.push(res);
        render();
      }
      if (preset) {
        gatherPick = preset.split(",");
        render();
      }
    });
    $("gatherUndo").addEventListener("click", function () {
      gatherPick.pop();
      render();
    });
    $("gatherConfirm").addEventListener("click", function () {
      act({ type: "gather", resources: gatherPick.slice() });
    });
    $("skipCraftBtn").addEventListener("click", function () {
      act({ type: "skipCraft" });
    });
    $("raidBtn").addEventListener("click", function () {
      act({ type: "raid" });
    });
    $("skipRaidBtn").addEventListener("click", function () {
      act({ type: "skipRaid" });
    });
    $("endTurnBtn").addEventListener("click", function () {
      act({ type: "endTurn" });
    });
    $("newMatchBtn").addEventListener("click", function () {
      pendingWipe = pendingWipe || (state && { wipe: state.wipe, seed: state.seed, setCounts: state.setCounts, meta: state.meta });
      showLobby({ resume: false });
    });
    $("winnerAgain").addEventListener("click", function () {
      $("winnerDialog").close();
      pendingWipe = pendingWipe || (state && { wipe: state.wipe, seed: state.seed, setCounts: state.setCounts, meta: state.meta });
      showLobby({ resume: false });
    });
  }

  function boot() {
    wire();
    pendingWipe = loadPending();
    var saved = loadSavedGame();
    if (wantsNew()) {
      if (!pendingWipe && saved) pendingWipe = { wipe: saved.wipe, seed: saved.seed, setCounts: saved.setCounts, meta: saved.meta };
      if (!pendingWipe) {
        showMissing();
        return;
      }
      state = saved;
      showLobby({ resume: !!saved });
      return;
    }
    if (saved) {
      state = saved;
      pendingWipe = pendingWipe || { wipe: saved.wipe, seed: saved.seed, setCounts: saved.setCounts, meta: saved.meta };
      render();
      toast("Resumed mid-wipe.");
      return;
    }
    if (pendingWipe) {
      showLobby();
      return;
    }
    showMissing();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
