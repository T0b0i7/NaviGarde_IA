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
await p.waitForTimeout(1800);

await p.evaluate(() => {
  window.__ngMarker = "kept";
});

const pausePanels = (ms) =>
  p.evaluate((t) => {
    let n = 0;
    document.getAnimations().forEach((a) => {
      const el = a.effect && a.effect.target;
      if (el && el.classList && el.classList.contains("ng-curtain-panel")) {
        a.pause();
        a.currentTime = t;
        n++;
      }
    });
    return n;
  }, ms);

const before = await p.evaluate(() => document.documentElement.classList.contains("dark"));
await p.locator(".split-theme .split-half").nth(before ? 0 : 1).click();
await p.waitForTimeout(60);
const nClosed = await pausePanels(336);
await p.waitForTimeout(80);
await p.screenshot({ path: "artifacts/curtain-closed.png" });

await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
await p.waitForTimeout(380);
const nOpen = await pausePanels(300);
await p.waitForTimeout(80);
await p.screenshot({ path: "artifacts/curtain-opening.png" });

await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
await p.waitForTimeout(1400);

const report = await p.evaluate(() => ({
  curtain: document.querySelectorAll(".ng-curtain").length,
  dark: document.documentElement.classList.contains("dark"),
  marker: window.__ngMarker,
}));
console.log(JSON.stringify({ before, nClosed, nOpen, ...report }));
await b.close();
process.exit(0);
