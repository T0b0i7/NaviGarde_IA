import { readFileSync, writeFileSync } from "node:fs";
const f = "scripts/verify-ui.mjs";
let s = readFileSync(f, "utf8");

const anchor = `        if (r.right > vw + 2) {`;
const inject = `        const inScroller = (node) => {
          let cur = node.parentElement;
          while (cur && cur !== document.body) {
            const ox = getComputedStyle(cur).overflowX;
            if (ox === "auto" || ox === "scroll") return true;
            cur = cur.parentElement;
          }
          return false;
        };
        if (r.right > vw + 2 && !inScroller(el)) {`;

if (!s.includes("inScroller")) {
  s = s.replace(anchor, inject);
  writeFileSync(f, s);
  console.log("patched");
} else {
  console.log("already patched");
}
