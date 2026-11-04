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
await p.waitForTimeout(2000);
const out = await p.evaluate(() => {
  const i = (el) => {
    if (!el) return null;
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { t: el.tagName.toLowerCase(), c: String(el.className).slice(0, 50), bg: c.backgroundColor, col: c.color, bd: c.borderColor, box: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] };
  };
  const at = (x, y) => i(document.elementFromPoint(x, y));
  return {
    y992: at(120, 992),
    y975: at(60, 975),
    brandCard: i(document.querySelector(".sidebar-brand-card")),
    nav: i(document.querySelector(".nav-item.active")),
    btn: i([...document.querySelectorAll("button")].find((x) => /New inspection|Nouvelle/i.test(x.textContent || ""))),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
process.exit(0);
