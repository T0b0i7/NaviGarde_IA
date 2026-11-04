import { readFileSync, writeFileSync } from "node:fs";
const files = ["client/src/pages/InspectionDetail.tsx", "client/src/pages/ReportDetail.tsx"];
const pairs = [
  ['width: "34%"', 'width: "30%"'],
  ['width: "12%"', 'width: "10%"'],
  ['width: "20%"', 'width: "31%"'],
];
for (const f of files) {
  let s = readFileSync(f, "utf8");
  for (const [a, b] of pairs) s = s.split(a).join(b);
  writeFileSync(f, s);
}
console.log("ok");
