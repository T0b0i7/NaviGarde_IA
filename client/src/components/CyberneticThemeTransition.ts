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
    emblem.innerHTML =
    '<span class="ng-emblem-disc"><img src="/logo-icon.png" alt="NaviGarde IA" /></span>' +
    '<span class="ng-emblem-glow"></span>' +
    '<span class="ng-emblem-ring"></span>';

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
    const fallback = window.setTimeout(resolve, 700);
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
  portal.root.classList.add("is-flash");
  await wait(150);
  portal.root.classList.add("is-opening");
  await wait(1100);

  portal.root.remove();
  if (active === portal) active = null;
}
