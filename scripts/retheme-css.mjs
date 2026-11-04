import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOKEN_MAP as MAP } from "./token-map.mjs";

const WHITE = new Set(["#fff", "#ffffff"]);
const SKIP = new Set(["client/src/design-system.css", "client/src/theme-midnight.css"]);
const apply = process.argv.includes("--apply");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replace(/\\/g, "/");
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

const files = walk("client/src").filter((f) => !SKIP.has(f));
const totals = {};
let touched = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const next = src.replace(/#[0-9a-fA-F]{3,8}\b/g, (match, offset) => {
    const lineStart = src.lastIndexOf("\n", offset) + 1;
    const line = src.slice(lineStart, src.indexOf("\n", offset) === -1 ? undefined : src.indexOf("\n", offset));
    if (/--[\w-]+\s*:/.test(line.slice(0, line.indexOf(match) + 1))) return match;

    const hex = match.toLowerCase();
    if (WHITE.has(hex)) {
      const before = src.slice(Math.max(0, offset - 18), offset);
      if (/color:\s*$/.test(before) || /fill:\s*$/.test(before)) return match;
      totals[hex] = (totals[hex] ?? 0) + 1;
      return "var(--ng-surface)";
    }
    const token = MAP[hex];
    if (!token) return match;
    totals[hex] = (totals[hex] ?? 0) + 1;
    return `var(${token})`;
  });
  if (next !== src) {
    touched += 1;
    if (apply) writeFileSync(file, next);
  }
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry", files: files.length, touched, totals }, null, 2));
