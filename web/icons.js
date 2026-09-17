/* Original stencil silhouettes for Wipe Table. No scraped artwork. */
(function (root) {
  "use strict";

  function svg(body, label) {
    return (
      '<svg class="stencil" viewBox="0 0 64 64" role="img" aria-label="' +
      label +
      '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect class="stencil-plate" x="2" y="2" width="60" height="60" rx="4"/>' +
      body +
      "</svg>"
    );
  }

  var ICONS = {
    bag: function (n) {
      return svg(
        '<path d="M20 28h24l-2 22H22z"/><path d="M24 28v-6c0-4 16-4 16 0v6" fill="none" stroke="currentColor" stroke-width="3"/>',
        n
      );
    },
    bow: function (n) {
      return svg(
        '<path d="M14 12c18 10 18 30 0 40" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 12l36 20L14 52" fill="none" stroke="currentColor" stroke-width="2"/>',
        n
      );
    },
    door: function (n) {
      return svg(
        '<path d="M20 10h24v44H20z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="38" cy="32" r="2.5"/>',
        n
      );
    },
    fire: function (n) {
      return svg(
        '<path d="M32 10c8 12-2 16 2 26 8-6 14 2 14 12 0 10-10 16-16 16s-16-6-16-16c0-14 12-24 16-38z"/>',
        n
      );
    },
    hatchet: function (n) {
      return svg(
        '<path d="M18 48l22-28"/><path d="M36 12l14 10-8 12-16-8z"/>',
        n
      );
    },
    garage: function (n) {
      return svg(
        '<path d="M12 14h40v38H12z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 24h32M16 34h32M16 44h32" fill="none" stroke="currentColor" stroke-width="2"/>',
        n
      );
    },
    turret: function (n) {
      return svg(
        '<rect x="22" y="28" width="20" height="22"/><rect x="28" y="12" width="8" height="18"/><circle cx="32" cy="12" r="5"/>',
        n
      );
    },
    recycler: function (n) {
      return svg(
        '<circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 16v12l10 6"/>',
        n
      );
    },
    cupboard: function (n) {
      return svg(
        '<rect x="16" y="12" width="32" height="40"/><rect x="20" y="16" width="24" height="10" class="cut"/><rect x="20" y="30" width="24" height="16" class="cut"/>',
        n
      );
    },
    armored: function (n) {
      return svg(
        '<path d="M32 8l20 8v16c0 14-12 24-20 28-8-4-20-14-20-28V16z"/>',
        n
      );
    },
    charge: function (n) {
      return svg(
        '<rect x="22" y="18" width="20" height="28" rx="2"/><path d="M32 18V10m-6 0h12"/><circle cx="32" cy="32" r="4" class="cut"/>',
        n
      );
    },
    wall: function (n) {
      return svg(
        '<path d="M8 44V22l8-6 8 6v22H8zm16 0V22l8-6 8 6v22H24zm16 0V22l8-6 8 6v22H40z"/>',
        n
      );
    },
    workbench: function (n) {
      return svg(
        '<rect x="10" y="26" width="44" height="8"/><path d="M16 34v18M48 34v18M22 18h20v8H22z"/>',
        n
      );
    },
    ammo: function (n) {
      return svg('<path d="M20 44l8-28h8l8 28H20zm10-28v-6h4v6"/>', n);
    },
    lighthouse: function (n) {
      return svg(
        '<path d="M28 54V24h8v30H28zM24 24h16l-2-8H26z"/><path d="M32 8v8M20 14l8 4M44 14l-8 4" fill="none" stroke="currentColor" stroke-width="2"/>',
        n
      );
    },
    cabins: function (n) {
      return svg('<path d="M10 36l12-12 12 12v18H10V36zm20 6l12-12 12 12v12H30V42z"/>', n);
    },
    outpost: function (n) {
      return svg(
        '<rect x="14" y="28" width="36" height="24"/><path d="M14 28l18-16 18 16"/><rect x="28" y="36" width="8" height="16" class="cut"/>',
        n
      );
    },
    bandit: function (n) {
      return svg(
        '<circle cx="32" cy="22" r="10"/><path d="M18 54c2-16 26-16 28 0"/><path d="M22 22h20" class="cut-line"/>',
        n
      );
    },
    airfield: function (n) {
      return svg(
        '<path d="M8 36h48M32 16v32"/><path d="M20 24h24v8H20z"/>',
        n
      );
    },
    train: function (n) {
      return (
        '<img class="stencil art-glyph art-glyph-crane" src="art/toe-crane.png" alt="' +
        n +
        '">'
      );
    },
    water: function (n) {
      return svg(
        '<rect x="14" y="12" width="12" height="40"/><rect x="38" y="12" width="12" height="40"/><path d="M10 48c8 6 16-6 24 0s16-6 20 0" fill="none" stroke="currentColor" stroke-width="3"/>',
        n
      );
    },
    tunnels: function (n) {
      return (
        '<img class="stencil art-glyph art-glyph-tunnels" src="art/lattice-spike.png" alt="' +
        n +
        '">'
      );
    },
    plant: function (n) {
      return svg(
        '<rect x="12" y="28" width="28" height="24"/><rect x="42" y="12" width="8" height="40"/><path d="M46 12c8 0 8 10 0 10"/>',
        n
      );
    },
    launch: function (n) {
      return svg(
        '<path d="M32 8l8 20H24z"/><rect x="26" y="28" width="12" height="20"/><path d="M20 54h24l-6-6H26z"/>',
        n
      );
    },
    airdrop: function (n) {
      return svg(
        '<path d="M32 8c10 8 14 16 14 16H18S22 16 32 8z"/><rect x="20" y="28" width="24" height="24"/>',
        n
      );
    },
    signal: function (n) {
      return svg(
        '<path d="M32 54V28"/><path d="M32 24c8 0 12-8 12-8M32 24c-8 0-12-8-12-8M32 18c5 0 8-6 8-6M32 18c-5 0-8-6-8-6"/><circle cx="32" cy="54" r="4"/>',
        n
      );
    },
    crate: function (n) {
      return svg(
        '<path d="M14 20h36v28H14z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 20l36 28M50 20L14 48" fill="none" stroke="currentColor" stroke-width="2"/>',
        n
      );
    },
    scientist: function (n) {
      return svg(
        '<circle cx="32" cy="18" r="8"/><path d="M20 54V34l12-6 12 6v20"/><rect x="26" y="36" width="12" height="8" class="cut"/>',
        n
      );
    },
    heavy: function (n) {
      return svg(
        '<circle cx="32" cy="16" r="7"/><path d="M16 54V32l16-8 16 8v22"/><rect x="22" y="34" width="20" height="10"/>',
        n
      );
    },
    chinook: function (n) {
      return svg(
        '<path d="M10 34h44v8H10z"/><path d="M8 28h16M40 28h16"/><circle cx="16" cy="46" r="4"/><circle cx="48" cy="46" r="4"/>',
        n
      );
    },
    heli: function (n) {
      return svg(
        '<path d="M8 28h48M32 28v8"/><path d="M18 36h22l6 10H16z"/><path d="M16 36c-8 0-8 8 0 8"/>',
        n
      );
    },
    cargo: function (n) {
      return svg(
        '<path d="M8 40h48l-6 10H14z"/><rect x="14" y="24" width="12" height="16"/><rect x="28" y="20" width="12" height="20"/><rect x="42" y="26" width="10" height="14"/>',
        n
      );
    },
    oil: function (n) {
      return svg(
        '<rect x="14" y="28" width="36" height="18"/><path d="M20 28V16h8v12M40 46v8M24 46v8"/><circle cx="44" cy="18" r="6"/>',
        n
      );
    },
    bradley: function (n) {
      return svg(
        '<path d="M8 34h40l6 12H10z"/><rect x="28" y="22" width="18" height="12"/><path d="M46 26h10"/><circle cx="18" cy="48" r="4"/><circle cx="38" cy="48" r="4"/>',
        n
      );
    },
    mark: function (n) {
      return svg('<path d="M16 44h32l-6-20H22z"/><circle cx="32" cy="16" r="5"/>', n);
    },
  };

  function cardIcon(card) {
    var key = (card && card.icon) || "mark";
    var draw = ICONS[key] || ICONS.mark;
    return draw(card && card.name ? card.name : "Card");
  }

  root.WipeIcons = { cardIcon: cardIcon, ICONS: ICONS };
})(typeof self !== "undefined" ? self : this);
