import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await ctx.newPage();
await p.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("navigarde_theme", "dark"));
await p.reload({ waitUntil: "networkidle" });
await p.fill("#login-email", "admin@navigarde.bj");
await p.fill("#login-password", "Admin12345678!");
await p.click('button[type="submit"]');
await p.waitForURL(BASE + "/", { timeout: 20000 });
await p.waitForTimeout(2200);
const out = await p.evaluate(() => {
  const res = [];
  document.querySelectorAll(".btn-blue, .btn-primary, .btn").forEach((el) => {
    const c = getComputedStyle(el);
    res.push({ cls: el.className, txt: (el.textContent || "").trim().slice(0, 22), col: c.color, bg: c.backgroundImage.slice(0, 60) + "|" + c.backgroundColor, filter: c.filter });
  });
  return res;
});
console.log(JSON.stringify(out, null, 2));
await b.close();
process.exit(0);
