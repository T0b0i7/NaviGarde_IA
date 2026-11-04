import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = `artifacts/${process.argv[2] === "light" ? "light" : "midnight"}`;
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["dashboard", "/"],
  ["inspections", "/inspections"],
  ["rapport", "/rapports/3"],
  ["navires", "/navires"],
  ["alertes", "/alertes"],
  ["operations", "/operations"],
  ["bulletins", "/bulletins"],
  ["parametres", "/parametres"],
];

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await page.evaluate((mode) => localStorage.setItem("navigarde_theme", mode), process.argv[2] === "light" ? "light" : "dark");
await page.reload({ waitUntil: "networkidle" });
await page.fill("#login-email", "admin@navigarde.bj");
await page.fill("#login-password", "Admin12345678!");
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/", { timeout: 20000 });
await page.waitForTimeout(1800);

const report = {};

for (const [name, route] of ROUTES) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

  report[name] = await page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(",").map((v) => parseFloat(v));
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      let node = el;
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0.35) return bg;
        node = node.parentElement;
      }
      return { r: 2, g: 11, b: 26, a: 1 };
    };
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const pathOf = (el) => {
      const parts = [];
      let node = el;
      for (let i = 0; i < 4 && node && node.tagName; i += 1) {
        const cls = (node.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
        parts.unshift(node.tagName.toLowerCase() + (cls ? "." + cls : ""));
        node = node.parentElement;
      }
      return parts.join(" > ");
    };

    const lowContrast = [];
    const whiteSurfaces = [];
    const nodes = document.querySelectorAll(
      "h1,h2,h3,h4,p,span,td,th,strong,small,label,a,button,li,div"
    );
    for (const el of nodes) {
      if (!el.textContent || el.children.length > 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 6) continue;
      const fg = parse(cs.color);
      if (!fg || fg.a < 0.5) continue;
      const bg = bgOf(el);
      const c = ratio(fg, bg);
      if (c < 3 && el.textContent.trim().length > 2) {
        lowContrast.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 40),
          path: pathOf(el),
          text: el.textContent.trim().slice(0, 34),
          ratio: Number(c.toFixed(2)),
          fg: cs.color,
          bg: `rgb(${bg.r},${bg.g},${bg.b})`,
        });
      }
      if (bg.r > 235 && bg.g > 235 && bg.b > 235 && rect.width > 120 && rect.height > 60) {
        whiteSurfaces.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 40),
          path: pathOf(el),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }

    const sidebarBg = getComputedStyle(document.querySelector(".sidebar") ?? document.body).backgroundColor;
    return {
      dark: document.documentElement.classList.contains("dark"),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      sidebarBg,
      lowContrast: lowContrast.slice(0, 12),
      lowContrastCount: lowContrast.length,
      whiteSurfaces: whiteSurfaces.slice(0, 8),
    };
  });
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(0);
