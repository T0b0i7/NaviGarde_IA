import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const OUT = "C:/Users/Eucher O. ABATTI/AppData/Local/Temp/navigarde-ui";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];

async function measure(label) {
  return page.evaluate((label) => {
    const out = { label, cells: [], badges: [], table: null };
    const table = document.querySelector(".anomalies-table");
    if (table) {
      const wrap = table.closest(".table-scroll");
      out.table = {
        width: Math.round(table.getBoundingClientRect().width),
        wrapWidth: wrap ? Math.round(wrap.clientWidth) : null,
        scrolls: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : false,
        rows: table.querySelectorAll("tbody tr").length,
      };
      table.querySelectorAll("tbody td").forEach((td, i) => {
        if (td.scrollWidth > td.clientWidth + 1) {
          out.cells.push({ i, text: (td.textContent ?? "").slice(0, 40), scroll: td.scrollWidth, client: td.clientWidth });
        }
      });
      table.querySelectorAll("tbody .bdg").forEach((b) => {
        const r = b.getBoundingClientRect();
        const cell = b.closest("td").getBoundingClientRect();
        if (r.right > cell.right + 0.5 || r.left < cell.left - 0.5) {
          out.badges.push({ text: (b.textContent ?? "").slice(0, 24), over: Math.round(r.right - cell.right) });
        }
      });
    }
    const body = document.documentElement;
    out.pageOverflow = body.scrollWidth > body.clientWidth + 1 ? { scroll: body.scrollWidth, client: body.clientWidth } : null;
    return out;
  }, label);
}

// --- login page ---
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.waitForSelector("#login-email");
const loginLayout = await page.evaluate(() => {
  const row = document.querySelector(".ng-row");
  const check = document.querySelector(".ng-check");
  const link = document.querySelector(".ng-row a");
  const pass = document.querySelector("#login-password");
  const eye = document.querySelector(".ng-eye");
  const heroBg = getComputedStyle(document.querySelector(".ng-left-bg")).backgroundImage;
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const cr = r(check);
  const lr = r(link);
  return {
    overlap: cr && lr ? lr.left < cr.right - 0.5 : null,
    checkRight: cr ? Math.round(cr.right) : null,
    linkLeft: lr ? Math.round(lr.left) : null,
    passPadRight: pass ? getComputedStyle(pass).paddingRight : null,
    eyeLeft: eye ? Math.round(eye.getBoundingClientRect().left) : null,
    heroBg: heroBg.slice(0, 90),
  };
});
await page.screenshot({ path: `${OUT}/login.png`, fullPage: true });

// --- login ---
await page.fill("#login-email", "admin@navigarde.bj");
await page.fill("#login-password", "Admin12345678!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 20000 });
await page.goto(`${BASE}/rapports/3`, { waitUntil: "networkidle" });
await page.waitForSelector(".anomalies-table, .mock-card", { timeout: 20000 });

const tab = page.getByRole("button", { name: /anomal/i }).first();
if (await tab.count()) await tab.click();
await page.waitForTimeout(800);
const wide = await measure("1440px");
await page.screenshot({ path: `${OUT}/report-anomalies-1440.png`, fullPage: true });

await page.setViewportSize({ width: 1024, height: 900 });
await page.waitForTimeout(400);
const medium = await measure("1024px");

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const mobile = await measure("390px");
await page.screenshot({ path: `${OUT}/report-anomalies-390.png`, fullPage: true });

for (const res of [wide, medium, mobile]) {
  if (res.pageOverflow) problems.push(`${res.label}: page overflows horizontally ${JSON.stringify(res.pageOverflow)}`);
  if (res.cells.length) problems.push(`${res.label}: ${res.cells.length} cell(s) clipped ${JSON.stringify(res.cells.slice(0, 3))}`);
  if (res.badges.length) problems.push(`${res.label}: ${res.badges.length} badge(s) overflow ${JSON.stringify(res.badges.slice(0, 3))}`);
}

// --- route sweep: detect elements sticking out of the viewport ---
const ROUTES = ["/", "/inspections", "/inspections/3", "/rapports", "/rapports/3", "/embarcations", "/alertes", "/bulletins", "/utilisateurs", "/audit", "/parametres"];
const sweep = [];
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  await page.setViewportSize(vp);
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(500);
    const res = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      document.querySelectorAll("body *").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.visibility === "hidden" || cs.display === "none") return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > vw + 2) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 60),
            right: Math.round(r.right),
            text: (el.textContent || "").trim().slice(0, 30),
          });
        }
      });
      return { vw, scroll: document.documentElement.scrollWidth, offenders: offenders.slice(0, 6), count: offenders.length };
    });
    sweep.push({ viewport: vp.width, route, ...res });
    if (res.count) problems.push(`${route} @${vp.width}: ${res.count} element(s) exceed viewport e.g. ${JSON.stringify(res.offenders[0])}`);
  }
}

console.log(JSON.stringify({ loginLayout, wide, medium, mobile, sweep, problems, out: OUT }, null, 2));
await browser.close();
process.exit(problems.length ? 2 : 0);
