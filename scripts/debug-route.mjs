import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text().slice(0, 400)}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message.slice(0, 600)}`));

await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("navigarde_theme", "dark"));
await page.reload({ waitUntil: "networkidle" });
await page.fill("#login-email", "admin@navigarde.bj");
await page.fill("#login-password", "Admin12345678!");
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/", { timeout: 20000 });
await page.waitForTimeout(1500);

for (const route of ["/inspections", "/rapports/3", "/navires"]) {
  logs.length = 0;
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const state = await page.evaluate(() => ({
    theme: document.documentElement.className,
    stored: localStorage.getItem("navigarde_theme"),
    rootChildren: document.getElementById("root")?.childElementCount ?? -1,
    bodyText: (document.body.innerText || "").slice(0, 120),
  }));
  console.log("=== " + route, JSON.stringify(state));
  console.log(logs.slice(0, 6).join("\n"));
}

await browser.close();
process.exit(0);
