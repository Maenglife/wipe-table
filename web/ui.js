(function () {
  "use strict";

  var engine = window.WipeEngine;
  var icons = window.WipeIcons;
  var SETS = [
    { name: "Survival", key: "survival", note: "Base set — gather, craft, build, and hold a compound." },
    { name: "Monuments", key: "monuments", note: "Shared island places — outpost, airfield, tunnels, launch." },
    { name: "Events", key: "events", note: "Pressure from the sky and shore — drops, heli, cargo, oil, Bradley." },
  ];
  var STORAGE_KEY = "wipe-table.saved.v1";
  var PENDING_PLAY_KEY = "wipe-table.pending-wipe.v1";
  var cards = [];
  var current = null;
  var saved = [];
  var view = "cards";
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

  function setInfo(name) {
    return SETS.find(function (s) { return s.name === name; }) || SETS[0];
  }

  function signature(wipe) {
    return wipe.map(function (c) { return c.id; }).slice().sort().join("|");
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(function () { $("toast").hidden = true; }, 3500);
  }

  function showError(message) {
    $("errorBox").textContent = message;
    $("errorBox").hidden = false;
    $("loadingState").hidden = true;
  }

  function selectedCounts() {
    var counts = {};
    SETS.forEach(function (s) {
      var input = $(s.key + "Count");
      var n = Number(input.value);
      if (input.value.trim() === "" || !Number.isSafeInteger(n) || n < 0 || n > Number(input.max)) {
        throw new Error("Choose a whole number from 0 to " + input.max + " for " + s.name + ".");
      }
      if (n > 0) counts[s.name] = n;
    });
    var total = Object.values(counts).reduce(function (a, n) { return a + n; }, 0);
    if (!total) throw new Error("Choose at least one wipe card.");
    if (!$("customSize").checked && total !== 10) {
      throw new Error("Choose 10 cards in total, or allow a custom number under Advanced.");
    }
    if ($("modeInput").value === "balanced" && total < 6) {
      throw new Error("Balanced costs needs at least 6 cards. Add more cards or choose Pure random.");
    }
    return counts;
  }

  function updateTotal() {
    var counts = SETS.map(function (s) { return Math.max(0, Number($(s.key + "Count").value) || 0); });
    var total = counts.reduce(function (a, n) { return a + n; }, 0);
    $("totalCount").textContent = String(total);
    var valid = false;
    try { selectedCounts(); valid = true; } catch (_) { /* Explain when generating. */ }
    $("totalLine").classList.toggle("warn", !valid);
    $("totalWarn").textContent = valid ? (total === 10 ? "Ready to play" : "Custom wipe") : "Adjust your mix";
    SETS.forEach(function (s, i) {
      $(s.key + "Bar").style.width = (total ? (counts[i] * 100) / total : 0) + "%";
    });
    if (current) {
      var previous = SETS.map(function (s) { return current.setCounts[s.name] || 0; });
      var changed =
        counts.some(function (n, i) { return n !== previous[i]; }) ||
        current.meta.mode !== $("modeInput").value;
      $("settingsStatus").textContent = changed ? "Settings changed. Generate to apply." : "";
    }
  }

  function updateModeHelp() {
    $("modeHelp").textContent =
      $("modeInput").value === "random"
        ? "Every card has an equal chance within its set. No cost restrictions."
        : "At least two cards in 2–3, two at 4, and two at 5. If three exact-5s stall with no top event, one 5 is swapped.";
    updateTotal();
  }

  function step(set, delta) {
    var input = $(set.key + "Count");
    input.value = String(Math.max(0, Math.min(Number(input.max), Math.floor(Number(input.value) || 0) + delta)));
    updateTotal();
  }

  function applyMix(values) {
    SETS.forEach(function (s, i) { $(s.key + "Count").value = String(values[i]); });
    updateTotal();
  }

  function colorFor(setName) {
    var key = setInfo(setName).key;
    if (key === "survival") return "var(--survival)";
    if (key === "monuments") return "var(--monuments)";
    return "var(--events)";
  }

  function renderCards() {
    if (!current) return;
    var wipe = current.wipe.slice();
    var order = $("sortInput").value;
    if (order === "name") wipe.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (order === "cost") wipe.sort(function (a, b) { return a.cost - b.cost || a.name.localeCompare(b.name); });
    $("cardList").replaceChildren();
    $("cardList").classList.toggle("list-view", view === "list");
    $("cardsView").setAttribute("aria-pressed", String(view === "cards"));
    $("listView").setAttribute("aria-pressed", String(view === "list"));
    wipe.forEach(function (card, index) {
      var button = make("button", "wipe-card");
      button.type = "button";
      button.setAttribute("aria-label", "View " + card.name + " details");
      button.style.setProperty("--set-color", colorFor(card.set));
      var art = make("span", "card-art");
      art.innerHTML = icons.cardIcon(card);
      art.append(make("span", "card-number", String(index + 1).padStart(2, "0")));
      art.append(make("span", "inspect-overlay", "View card ↗"));
      var caption = make("span", "card-caption");
      var row = make("span", "card-title-row");
      row.append(make("span", "card-title", card.name));
      var cost = make("span", "card-cost", String(card.cost));
      cost.setAttribute("aria-label", "Cost " + card.cost);
      row.append(cost);
      var meta = make("span", "card-meta");
      meta.append(make("span", "card-set", card.set), make("span", "card-type", card.types_summary));
      caption.append(row, meta);
      button.append(art, caption);
      button.addEventListener("click", function () { openCard(card); });
      $("cardList").append(button);
    });
  }

  function renderCurrent() {
    var wipe = current.wipe;
    var meta = current.meta;
    var seed = current.seed;
    var setCounts = current.setCounts;
    $("loadingState").hidden = true;
    $("errorBox").hidden = true;
    $("results").hidden = false;
    $("statusLine").textContent = wipe.length + " cards on the island · " + Object.keys(setCounts).length + " sets in play";
    $("setSummary").replaceChildren();
    SETS.forEach(function (s) {
      if (!setCounts[s.name]) return;
      var span = make("span", s.key);
      span.append(make("i", "set-dot"), document.createTextNode(setCounts[s.name] + " " + s.name));
      $("setSummary").append(span);
    });
    $("resultMode").textContent = engine.modeLabel(meta.mode);
    $("metaLine").textContent =
      engine.modeLabel(meta.mode) +
      " · Seed " +
      seed +
      (meta.attempts ? " · " + meta.attempts + (meta.attempts === 1 ? " attempt" : " attempts") : " · Restored saved wipe");
    var bands = engine.bandCounts(wipe);
    $("curveBox").replaceChildren();
    [
      ["2-3", "2–3"],
      ["4", "4"],
      ["5", "5"],
      ["top", "6+ / event"],
    ].forEach(function (pair) {
      var span = make("span");
      span.append(make("strong", "", String(bands[pair[0]])), document.createTextNode(" at " + pair[1]));
      $("curveBox").append(span);
    });
    $("repairBox").hidden = !meta.repaired;
    $("repairBox").textContent = meta.repaired
      ? "The balanced policy replaced a 5-cost card with " + meta.repair_to + " so the table has a wipe-end event."
      : "";
    $("policyNote").textContent =
      meta.mode === "random"
        ? "Cost bands describe this wipe; they did not restrict selection."
        : "House preference: at least two cards in each band (2–3, 4, and 5). Three or more exact-5 cards with no top event swap one 5 for a 6+/event from the same set when possible.";
    $("copyBtn").disabled = false;
    $("saveBtn").disabled = false;
    $("playBtn").disabled = false;
    updateSaveButton();
    renderCards();
    updateTotal();
  }

  function generate(fresh, userInitiated) {
    try {
      var setCounts = selectedCounts();
      var seedInput = fresh ? "" : $("seedInput").value.trim();
      var rngPair = engine.makeRng(seedInput);
      var result = engine.sampleWipe(
        cards,
        setCounts,
        rngPair.rng,
        500,
        $("modeInput").value,
        $("customSize").checked
      );
      current = { wipe: result.wipe, meta: result.meta, seed: rngPair.seed, setCounts: setCounts };
      $("seedInput").value = rngPair.seed;
      $("wipeKicker").textContent = "TONIGHT ON THE ISLAND";
      renderCurrent();
      if (userInitiated && window.matchMedia("(max-width: 860px)").matches) {
        $("setupPanel").open = false;
        $("wipeHeading").focus({ preventScroll: true });
        $("wipeHeading").scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        });
      }
    } catch (error) {
      showError(error.message || "Could not create this wipe. Try another mix.");
      if (userInitiated) $("errorBox").scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function openCard(card) {
    var content = make("div", "card-dialog-layout");
    var art = make("div", "dialog-art");
    art.style.setProperty("--set-color", colorFor(card.set));
    art.innerHTML = icons.cardIcon(card);
    var info = make("div", "dialog-card-info");
    info.append(make("p", "eyebrow", card.set));
    var title = make("h2", "", card.name);
    title.id = "cardDialogTitle";
    info.append(title);
    var costLine = make("p", "member-types", "Cost " + card.cost + " · " + card.band + " · " + card.types_summary);
    info.append(costLine);
    info.append(make("p", "member-text", card.rules || "See the printed card for its rules."));
    if (card.flavor) info.append(make("p", "flavor", card.flavor));
    content.append(art, info);
    $("cardDialogBody").replaceChildren(content);
    $("cardDialog").showModal();
  }

  function loadSaved() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      saved = Array.isArray(data)
        ? data
            .filter(function (s) {
              return (
                s &&
                typeof s.id === "string" &&
                Array.isArray(s.ids) &&
                s.ids.length <= 90 &&
                s.ids.every(function (id) { return typeof id === "string"; }) &&
                (s.mode === "random" || s.mode === "balanced")
              );
            })
            .slice(0, 50)
        : [];
    } catch (_) {
      saved = [];
    }
    $("savedCount").textContent = String(saved.length);
  }

  function persistSaved(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      saved = next;
      $("savedCount").textContent = String(saved.length);
      return true;
    } catch (_) {
      toast("This browser can't save right now. Copy the wipe instead.");
      return false;
    }
  }

  function updateSaveButton() {
    var exists = current && saved.some(function (s) { return s.id === signature(current.wipe); });
    $("saveBtn").replaceChildren(make("span", "", exists ? "◆" : "◇"), document.createTextNode(exists ? " Saved" : " Save"));
    $("saveBtn").setAttribute("aria-pressed", String(!!exists));
  }

  function saveCurrent() {
    if (!current) return;
    if (saved.some(function (s) { return s.id === signature(current.wipe); })) {
      $("savedDialog").showModal();
      renderSaved();
      return;
    }
    if (saved.length >= 50) {
      toast("Your shelf has 50 wipes. Remove one to save another.");
      return;
    }
    var entry = {
      id: signature(current.wipe),
      ids: current.wipe.map(function (c) { return c.id; }),
      mode: current.meta.mode,
      seed: current.seed,
      savedAt: new Date().toISOString(),
    };
    if (persistSaved([entry].concat(saved))) {
      updateSaveButton();
      toast("Wipe saved on this browser.");
    }
  }

  function renderSaved() {
    $("savedList").replaceChildren();
    if (!saved.length) {
      $("savedList").append(
        make("p", "empty-shelf", "A good wipe is worth another night. Save one from the builder and it will appear here.")
      );
      return;
    }
    saved.forEach(function (entry) {
      var restored = entry.ids.map(function (id) { return cards.find(function (c) { return c.id === id; }); }).filter(Boolean);
      var item = make("article", "saved-item");
      item.append(make("h3", "", restored.slice(0, 2).map(function (c) { return c.name; }).join(" & ") || "Saved wipe"));
      item.append(make("p", "help", engine.modeLabel(entry.mode) + " · " + restored.length + " cards"));
      item.append(make("p", "", restored.map(function (c) { return c.name; }).join(" · ")));
      var actions = make("div", "saved-item-actions");
      var open = make("button", "saved-open", "Open");
      var remove = make("button", "saved-remove", "Remove");
      open.addEventListener("click", function () {
        if (restored.length !== entry.ids.length || new Set(entry.ids).size !== entry.ids.length) {
          toast("Some saved cards aren't in this catalog. Generate a new wipe.");
          return;
        }
        var counts = {};
        restored.forEach(function (c) { counts[c.set] = (counts[c.set] || 0) + 1; });
        current = {
          wipe: restored,
          setCounts: counts,
          seed: String(entry.seed || ""),
          meta: { mode: entry.mode, attempts: 0, repaired: false },
        };
        SETS.forEach(function (s) { $(s.key + "Count").value = String(counts[s.name] || 0); });
        $("customSize").checked = restored.length !== 10;
        $("modeInput").value = entry.mode;
        $("seedInput").value = current.seed;
        $("wipeKicker").textContent = "BACK ON THE TABLE";
        updateModeHelp();
        renderCurrent();
        $("savedDialog").close();
        $("wipeHeading").focus();
      });
      remove.setAttribute("aria-label", "Remove saved wipe " + restored.slice(0, 2).map(function (c) { return c.name; }).join(" and "));
      remove.addEventListener("click", function () {
        if (persistSaved(saved.filter(function (s) { return s.id !== entry.id; }))) {
          renderSaved();
          updateSaveButton();
        }
      });
      actions.append(open, remove);
      item.append(actions);
      $("savedList").append(item);
    });
  }

  function stashCurrentWipe() {
    if (!current) return false;
    try {
      localStorage.setItem(
        PENDING_PLAY_KEY,
        JSON.stringify({
          wipe: current.wipe,
          seed: current.seed,
          setCounts: current.setCounts,
          meta: current.meta,
        })
      );
      return true;
    } catch (_) {
      toast("This browser can't start Play right now.");
      return false;
    }
  }

  function playCurrent() {
    if (!stashCurrentWipe()) return;
    window.location.href = "play.html?new=1";
  }

  function copyCurrent() {
    if (!current) return;
    var text = engine.formatWipeText(current.wipe, current.setCounts, current.meta, current.seed);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast("Wipe copied. Send it to the table."); },
        function () { fallbackCopy(text); }
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var dialog = make("dialog", "shelf-dialog");
    var title = make("h2", "", "Copy your wipe");
    var area = document.createElement("textarea");
    var close = make("button", "small-button", "Done");
    title.id = "copyTitle";
    dialog.setAttribute("aria-labelledby", title.id);
    area.value = text;
    area.readOnly = true;
    area.setAttribute("aria-label", "Wipe text to copy");
    area.style.cssText = "width:100%;min-height:320px;padding:14px;background:#0f0c0a;color:var(--ink);border:1px solid var(--line);font:inherit;margin-bottom:16px;";
    close.addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("close", function () { dialog.remove(); });
    dialog.append(title, make("p", "help", "Select and copy the text below."), area, close);
    document.body.append(dialog);
    dialog.showModal();
    area.focus();
    area.select();
  }

  function renderCollection() {
    $("collectionList").replaceChildren();
    SETS.forEach(function (s) {
      var item = make("div", "collection-item");
      var info = make("div");
      var count = cards.filter(function (c) { return c.set === s.name; }).length;
      info.append(make("h3", "", s.name), make("p", "", s.note), make("p", "", count + " cards available"));
      item.append(make("span", "set-monogram " + s.key, s.name[0]), info);
      $("collectionList").append(item);
    });
  }

  function wire() {
    SETS.forEach(function (s) {
      $(s.key + "Minus").addEventListener("click", function () { step(s, -1); });
      $(s.key + "Plus").addEventListener("click", function () { step(s, 1); });
      $(s.key + "Count").addEventListener("input", updateTotal);
    });
    $("modeInput").addEventListener("change", updateModeHelp);
    $("customSize").addEventListener("change", updateTotal);
    $("defaultMix").addEventListener("click", function () { applyMix([4, 3, 3]); });
    $("baseMix").addEventListener("click", function () { applyMix([10, 0, 0]); });
    $("rerollBtn").addEventListener("click", function () { generate(true, true); });
    $("generateBtn").addEventListener("click", function () { generate(false, true); });
    $("seedInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") generate(false, true);
    });
    $("sortInput").addEventListener("change", renderCards);
    $("cardsView").addEventListener("click", function () { view = "cards"; renderCards(); });
    $("listView").addEventListener("click", function () { view = "list"; renderCards(); });
    $("saveBtn").addEventListener("click", saveCurrent);
    $("playBtn").addEventListener("click", playCurrent);
    $("navPlay").addEventListener("click", function () {
      stashCurrentWipe();
    });
    $("copyBtn").addEventListener("click", copyCurrent);
    $("savedBtn").addEventListener("click", function () { renderSaved(); $("savedDialog").showModal(); });
    $("collectionBtn").addEventListener("click", function () { renderCollection(); $("collectionDialog").showModal(); });
    $("rulesBtn").addEventListener("click", function () { $("rulesDialog").showModal(); });
    document.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () { $(button.dataset.close).close(); });
    });
  }

  function boot() {
    wire();
    loadSaved();
    try {
      var data = window.EMBEDDED_CATALOG;
      if (!data) throw new Error("Catalog embed missing. Run node tools/embed-catalog.js");
      cards = engine.loadCatalog(data);
      if (!cards.length) throw new Error("No wipe cards were found.");
      SETS.forEach(function (s) {
        var count = cards.filter(function (c) { return c.set === s.name; }).length;
        $(s.key + "Count").max = String(count);
        $(s.key + "Available").textContent = String(count);
      });
      $("catalogSummary").textContent = cards.length + " cards · Survival · Monuments · Events";
      $("rerollBtn").disabled = false;
      $("generateBtn").disabled = false;
      updateModeHelp();
      generate(true, false);
    } catch (error) {
      showError(error.message || "The catalog couldn't be loaded.");
      $("rerollBtn").disabled = true;
      $("generateBtn").disabled = true;
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
