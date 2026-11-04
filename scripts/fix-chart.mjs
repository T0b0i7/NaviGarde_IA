import { readFileSync, writeFileSync } from "node:fs";
const p = "client/src/components/ui/chart.tsx";
let s = readFileSync(p, "utf8");
const before = s;
s = s.split("[stroke='var(--ng-surface)']").join("[stroke='#fff']");
writeFileSync(p, s);
console.log(s !== before ? "restored" : "no change");
