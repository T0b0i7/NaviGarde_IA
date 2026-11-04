/**
 * Voile / rideau de transition entre thèmes.
 * Deux voiles se referment au centre, le thème bascule quand l'écran est
 * entièrement couvert, un éclat bref marque la rencontre des liserés,
 * puis les voiles s'ouvrent sur la nouvelle palette.
 */

type Curtain = {
  root: HTMLDivElement;
  left: HTMLDivElement;
};

let active: Curtain | null = null;

function build(direction: "to-dark" | "to-light"): Curtain {
  const root = document.createElement("div");
  root.className = "ng-curtain";
  root.dataset.direction = direction;
  root.setAttribute("aria-hidden", "true");

  const left = document.createElement("div");
  left.className = "ng-curtain-panel ng-curtain-left";
  const right = document.createElement("div");
  right.className = "ng-curtain-panel ng-curtain-right";
  const burst = document.createElement("div");
  burst.className = "ng-curtain-burst";

  root.append(left, right, burst);
  document.body.appendChild(root);
  return { root, left };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/** Résout quand les voiles sont complètement fermées (animationend, repli sur un délai). */
function closed(panel: HTMLDivElement) {
  return new Promise<void>((resolve) => {
    const fallback = window.setTimeout(resolve, 520);
    panel.addEventListener(
      "animationend",
      () => {
        window.clearTimeout(fallback);
        resolve();
      },
      { once: true }
    );
  });
}

export async function playThemeCurtain(from: "light" | "dark", apply: () => void) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !document.body) {
    apply();
    return;
  }

  active?.root.remove();
  const direction = from === "dark" ? "to-light" : "to-dark";
  const curtain = build(direction);
  active = curtain;

  curtain.root.classList.add("is-closing");
  await closed(curtain.left);

  // bascule masquée : l'écran est entièrement couvert par les deux voiles
  apply();
  curtain.root.classList.remove("is-closing");
  curtain.root.classList.add("is-burst", "is-opening");
  await wait(780);

  curtain.root.remove();
  if (active === curtain) active = null;
}
