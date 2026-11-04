import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await p.fill("#login-email", "admin@navigarde.bj");
await p.fill("#login-password", "Admin12345678!");
await p.click('button[type="submit"]');
await p.waitForURL(BASE + "/", { timeout: 20000 });
await p.waitForTimeout(1800);
await p.locator(".split-theme .split-half").nth(1).click();
await p.waitForTimeout(80);
await p.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 300; }));
await p.screenshot({ path: "artifacts/curtain-closed.png" });
await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
await p.waitForTimeout(500);
await p.evaluate(() => {
  document.getAnimations().forEach((a) => {
    if (String(a.animationName || "").startsWith("ng-curtain-open")) { a.pause(); a.currentTime = 220; }
  });
});
await p.screenshot({ path: "artifacts/curtain-opening.png" });
await b.close();
process.exit(0);
