import { chromium } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));

await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await page.fill("#login-email", "admin@navigarde.bj");
await page.fill("#login-password", "Admin12345678!");
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/", { timeout: 20000 });

const out = {};

await page.goto(BASE + "/rapports", { waitUntil: "networkidle" });
await page.waitForSelector(".mock-table tbody tr", { timeout: 20000 });
const rowsActive = await page.locator(".mock-table tbody tr").count();
const ref = (await page.locator(".mock-table tbody tr").first().locator("td").first().innerText()).trim();
await page.locator('.mock-table tbody tr').first().locator('.icon-sq.danger').click();
await page.waitForSelector(".ng-modal", { timeout: 10000 });
await page.locator(".ng-modal-actions button").last().click();
await page.waitForSelector(".ng-modal", { state: "detached", timeout: 20000 });
await page.waitForTimeout(1200);
const rowsAfterArchive = await page.locator(".mock-table tbody tr").count();

await page.locator('.scope-switch button[role="tab"]').nth(1).click();
await page.waitForTimeout(1200);
const archivedRefs = await page.locator(".mock-table tbody tr td:first-child").allInnerTexts();
out.reports = {
  rowsActive,
  ref,
  rowsAfterArchive,
  archivedCount: archivedRefs.length,
  refInArchive: archivedRefs.some((x) => x.trim() === ref),
};

await page.locator('.mock-table tbody tr').first().locator('.icon-sq.restore').click();
await page.waitForSelector(".ng-modal", { timeout: 10000 });
await page.locator(".ng-modal-actions button").last().click();
await page.waitForSelector(".ng-modal", { state: "detached", timeout: 20000 });
await page.waitForTimeout(1200);
await page.locator('.scope-switch button[role="tab"]').nth(0).click();
await page.waitForTimeout(1200);
const activeRefs = await page.locator(".mock-table tbody tr td:first-child").allInnerTexts();
out.restored = activeRefs.some((x) => x.trim() === ref);

await page.goto(BASE + "/audit", { waitUntil: "networkidle" });
await page.waitForSelector(".audit-row", { timeout: 20000 });
const auditRows = await page.locator(".audit-row").count();
const firstAction = (await page.locator(".audit-row").first().innerText()).split("\n")[0].trim();
await page.locator(".audit-row").first().click();
await page.waitForSelector(".ng-modal.wide", { timeout: 15000 });
await page.waitForTimeout(900);
const detail = await page.locator(".ng-modal.wide").innerText();
out.audit = {
  rows: auditRows,
  firstAction,
  modalOpen: await page.locator(".ng-modal.wide").isVisible(),
  hasIp: /Adresse IP|IP address/.test(detail),
  hasAgent: /Navigateur|User agent/.test(detail),
  hasMetadata: /Métadonnées|Metadata/.test(detail),
  hasArchiveEvent: /report\.archive|report\.restore/.test(await page.locator("body").innerText()),
};
await page.locator(".ng-modal.wide button.icon-sq").first().click();
await page.waitForSelector(".ng-modal.wide", { state: "detached", timeout: 10000 });

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(0);
