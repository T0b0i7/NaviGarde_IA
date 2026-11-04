import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [];

for (let i = 0; i < 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const navs = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs.push(new URL(f.url()).pathname); });

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#login-email", { timeout: 15000 });
  await page.fill("#login-email", "admin@navigarde.bj");
  await page.fill("#login-password", "Admin12345678!");
  await page.click('button[type="submit"]');
  let ok = true;
  try {
    await page.waitForURL(BASE + "/", { timeout: 15000 });
  } catch {
    ok = false;
  }
  await page.waitForTimeout(1500);
  const path = new URL(page.url()).pathname;
  const hasShell = await page.locator(".mock-h1, .app-shell, aside").first().isVisible().catch(() => false);
  results.push({ attempt: i + 1, ok, path, hasShell, navs });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(0);
