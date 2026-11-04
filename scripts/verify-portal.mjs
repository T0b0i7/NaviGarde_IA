import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await p.fill("#login-email", "admin@navigarde.bj");
await p.fill("#login-password", "Admin12345678!");
await p.click('button[type="submit"]');
await p.waitForURL(BASE + "/", { timeout: 20000 });
await p.waitForTimeout(1600);
await p.evaluate(() => { window.__ngMarker = "kept"; });

const before = await p.evaluate(() => document.documentElement.classList.contains("dark"));
await p.locator(".split-theme .split-half").nth(before ? 0 : 1).click();
await p.waitForTimeout(120);
await p.screenshot({ path: "artifacts/portal-live-mid.png" });
await p.waitForTimeout(1600);

const after = await p.evaluate(() => ({
  portal: document.querySelectorAll(".ng-portal").length,
  dark: document.documentElement.classList.contains("dark"),
  marker: window.__ngMarker,
}));
console.log(JSON.stringify({ before, ...after }));
await b.close();
process.exit(0);
