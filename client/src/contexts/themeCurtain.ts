/**
 * Voile / rideau de transition entre thèmes.
 * Deux panneaux en forme de voile se ferment, le thème bascule, puis ils s'ouvrent.
 */

type Curtain = { root: HTMLDivElement; left: HTMLDivElement; right: HTMLDivElement };

let active: Curtain | null = null;

function build(from: "light" | "dark"): Curtain {
  const root = document.createElement("div");
  root.className = "ng-curtain";
  root.dataset.from = from;
  root.setAttribute("aria-hidden", "true");

  const left = document.createElement("div");
  left.className = "ng-curtain-panel ng-curtain-left";
  const right = document.createElement("div");
  right.className = "ng-curtain-panel ng-curtain-right";

  root.append(left, right);
  document.body.appendChild(root);
  return { root, left, right };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export async function playThemeCurtain(from: "light" | "dark", apply: () => void) {  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !document.body) {
    apply();
    return;
  }

  active?.root.remove();
  const curtain = build(from);
  active = curtain;

  curtain.root.classList.add("is-closing");
  await wait(330);

  apply();
  curtain.root.dataset.from = from === "dark" ? "light" : "dark";
  curtain.root.classList.remove("is-closing");
  curtain.root.classList.add("is-opening");
  await wait(700);

  curtain.root.remove();
  if (active === curtain) active = null;
}
