/**
 * CyberneticThemeTransition - portes metalliques de transition de theme.
 * Rendu en DOM imperatif : aucun re-render React, donc aucun etat perdu.
 */

type Portal = { root: HTMLDivElement; left: HTMLDivElement; right: HTMLDivElement };

let active: Portal | null = null;

const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

function door(side: "left" | "right") {
  const el = document.createElement("div");
  el.className = "ng-door ng-door-" + side;
  el.innerHTML =
    '<div class="ng-door-frame"></div>' +
    '<div class="ng-door-metal">' +
    '<div class="ng-ridges"></div>' +
    '<div class="ng-plate"></div>' +
    '<div class="ng-chev">' + CHEV + "</div>" +
    "</div>";
  return el;
}

export function buildPortal(direction: "to-dark" | "to-light"): Portal {
  const root = document.createElement("div");
  root.className = "ng-portal";
  root.dataset.direction = direction;
  root.setAttribute("aria-hidden", "true");

  const core = document.createElement("div");
  core.className = "ng-core";

  const left = door("left");
  const right = door("right");

  const beam = document.createElement("div");
  beam.className = "ng-beam";

  const emblem = document.createElement("div");
  emblem.className = "ng-emblem";
  const SHIP =
    '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M32 6v18" /><path d="M32 10c9 5 13 12 13 20H32z" /><path d="M32 12c-8 5-12 11-12 18h12z" />' +
    '<path d="M14 34h36l-6 12H20z" /><path d="M20 50c4 3 8 4 12 4s8-1 12-4" />' +
    "</svg>";
  emblem.innerHTML = '<span class="ng-emblem-ship">' + SHIP + "</span><span class=\"ng-emblem-glow\"></span>";

  const flash = document.createElement("div");
  flash.className = "ng-flash";

  root.append(core, left, right, beam, emblem, flash);
  document.body.appendChild(root);
  return { root, left, right };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function closed(el: HTMLDivElement) {
  return new Promise<void>((resolve) => {
    const fallback = window.setTimeout(resolve, 420);
    el.addEventListener("animationend", () => { window.clearTimeout(fallback); resolve(); }, { once: true });
  });
}

/** Joue la transition ; `apply` bascule reellement le theme. */
export async function playCyberneticTransition(from: "light" | "dark", apply: () => void) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !document.body) { apply(); return; }

  active?.root.remove();
  const portal = buildPortal(from === "dark" ? "to-light" : "to-dark");
  active = portal;

  portal.root.classList.add("is-closing");
  await closed(portal.left);

  apply();
  portal.root.classList.remove("is-closing");
  portal.root.classList.add("is-flash", "is-opening");
  await wait(720);

  portal.root.remove();
  if (active === portal) active = null;
}
