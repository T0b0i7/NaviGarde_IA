import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text().slice(0, 500)}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message.slice(0, 800)}`));
page.on("requestfailed", (r) => logs.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({
  theme: document.documentElement.className,
  rootChildren: document.getElementById("root")?.childElementCount ?? -1,
  bodyText: (document.body.innerText || "").slice(0, 200),
  emailInput: Boolean(document.querySelector("#login-email")),
}));
console.log(JSON.stringify(info, null, 2));
console.log(logs.join("\n"));
await page.screenshot({ path: "artifacts/midnight/debug-login.png" });
await browser.close();
process.exit(0);
