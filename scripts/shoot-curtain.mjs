import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const file = pathToFileURL(resolve("artifacts/curtain-harness.html")).href;
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const shots = [
  ["closed", "to-dark", 336, "artifacts/curtain-closed.png"],
  ["open", "to-dark", 150, "artifacts/curtain-open-150.png"],
  ["open", "to-dark", 300, "artifacts/curtain-open-300.png"],
  ["open", "to-dark", 460, "artifacts/curtain-open-460.png"],
];

for (const [state, dir, t, out] of shots) {
  await p.goto(`${file}?state=${state}&dir=${dir}&t=${t}`);
  await p.waitForTimeout(250);
  await p.screenshot({ path: out });
  console.log("ok", out);
}

await b.close();
process.exit(0);
