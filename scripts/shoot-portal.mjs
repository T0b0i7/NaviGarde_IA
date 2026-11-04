import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const file = pathToFileURL(resolve("artifacts/portal-harness.html")).href;
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

const shots = [
  ["closed", 290, "artifacts/portal-closed.png"],
  ["open", 90, "artifacts/portal-open-90.png"],
  ["open", 260, "artifacts/portal-open-260.png"],
];

for (const [state, t, out] of shots) {
  await p.goto(`${file}?state=${state}&t=${t}`);
  await p.waitForTimeout(250);
  await p.screenshot({ path: out });
  console.log("ok", out);
}

await b.close();
process.exit(0);
