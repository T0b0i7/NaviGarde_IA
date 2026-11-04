import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** hex -> semantic token (light value lives in design-system.css, dark in theme-midnight.css) */
const MAP = {
  // neutrals / typography
  "#0a2a5e": "--ng-ink",
  "#0f2d4a": "--ng-ink",
  "#113457": "--ng-ink",
  "#143859": "--ng-body",
  "#5b7a96": "--ng-soft",
  "#64748b": "--ng-soft",
  "#7b93a8": "--ng-faint",
  "#8aa3bb": "--ng-faint-2",
  "#0d7fdd": "--ng-link",
  // lines & surfaces
  "#d9e6f2": "--ng-line",
  "#dce8ef": "--ng-line",
  "#cbd9e6": "--ng-line",
  "#e3ecf4": "--ng-line-2",
  "#9ec7e8": "--ng-line-2",
  "#eef3f8": "--ng-line-soft",
  "#eef2f6": "--ng-grid",
  "#edf2f7": "--ng-chip",
  "#eef5fb": "--ng-tint",
  "#eef6fd": "--ng-tint",
  "#f4f9fe": "--ng-tint",
  "#eaf4fc": "--ng-tint-2",
  // status
  "#16a34a": "--ng-ok",
  "#15803d": "--ng-ok-strong",
  "#dcfce7": "--ng-ok-bg",
  "#f59e0b": "--ng-warn",
  "#fef3c7": "--ng-warn-bg",
  "#f97316": "--ng-high",
  "#ef4444": "--ng-crit",
  "#dc2626": "--ng-crit-2",
  "#b91c1c": "--ng-crit-strong",
  "#fef2f2": "--ng-crit-bg",
  "#fee2e2": "--ng-crit-bg-2",
  "#fecaca": "--ng-crit-border",
  "#2563eb": "--ng-info",
  "#0ea5e9": "--ng-info-2",
  "#60a5fa": "--ng-info-3",
  "#e0f2fe": "--ng-info-bg",
  "#7c3aed": "--ng-purple",
  "#0d9488": "--ng-teal",
  "#0ca7b0": "--ng-teal",
  "#5b8fc4": "--ng-faint-2",
  "#94a3b8": "--ng-soft",
  "#d8eaf5": "--ng-line-2",
  "#dceefb": "--ng-line",
  "#f6fafd": "--ng-tint",
  "#f4f7fb": "--ng-tint",
  "#c2410c": "--ng-high",
  "#d97706": "--ng-high",
  "#fcd34d": "--ng-warn",
  "#92400e": "--ng-warn",
  "#fca5a5": "--ng-crit-border",
  "#fff7f7": "--ng-crit-bg",
};

/** #fff means "surface" when it is a background/fill, but stays literal white when it is text on a colored chip. */
const WHITE = new Set(["#fff", "#ffffff"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function rewrite(src, totals) {
  return src.replace(/#[0-9a-fA-F]{3,8}\b/g, (match, offset) => {
    const hex = match.toLowerCase();
    if (WHITE.has(hex)) {
      const before = src.slice(Math.max(0, offset - 16), offset);
      if (/color:\s*"$/.test(before) || /color="$/.test(before)) return match;
      totals[hex] = (totals[hex] ?? 0) + 1;
      return "var(--ng-surface)";
    }
    const token = MAP[hex];
    if (!token) return match;
    totals[hex] = (totals[hex] ?? 0) + 1;
    return `var(${token})`;
  });
}

const files = walk("client/src");
const totals = {};
const touched = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const next = rewrite(src, totals);
  if (next !== src) {
    writeFileSync(file, next);
    touched.push(file);
  }
}

console.log(JSON.stringify({ scanned: files.length, touched: touched.length, totals }, null, 2));
