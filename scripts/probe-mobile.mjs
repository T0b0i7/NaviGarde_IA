import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await p.fill("#login-email", "admin@navigarde.bj");
await p.fill("#login-password", "Admin12345678!");
await p.click('button[type="submit"]');
await p.waitForURL(BASE + "/", { timeout: 20000 });
await p.goto(BASE + "/rapports/3", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const out = await p.evaluate(() => {
  const wrap = document.querySelector(".table-scroll");
  const t = document.querySelector(".anomalies-table");
  const rows = [...document.querySelectorAll(".anomalies-table tbody tr")].slice(0, 3).map((tr) => ({
    h: Math.round(tr.getBoundingClientRect().height),
    cells: [...tr.children].map((td) => Math.round(td.getBoundingClientRect().height)),
  }));
  const cs = wrap ? getComputedStyle(wrap) : null;
  return {
    wrap: cs ? { display: cs.display, overflowX: cs.overflowX, w: Math.round(wrap.getBoundingClientRect().width) } : null,
    tableW: t ? Math.round(t.getBoundingClientRect().width) : null,
    rows,
    topActions: (() => {
      const el = document.querySelector(".top-actions");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), kids: [...el.children].map((k) => Math.round(k.getBoundingClientRect().width)) };
    })(),
    topbar: (() => {
      const el = document.querySelector(".topbar");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), pad: getComputedStyle(el).padding, gap: getComputedStyle(el).gap };
    })(),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
process.exit(0);
