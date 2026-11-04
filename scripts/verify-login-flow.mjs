import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });

// wrong password: must stay on the form, no full reload
await page.fill("#login-email", "admin@navigarde.bj");
await page.fill("#login-password", "wrong-password-123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
const stillForm = await page.locator("#login-email").isVisible();
const errorShown = await page.locator(".ng-error").isVisible().catch(() => false);
const emailKept = await page.inputValue("#login-email");

// correct password with remember me
await page.fill("#login-password", "Admin12345678!");
await page.locator(".ng-check input").check();
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
const afterLogin = new URL(page.url()).pathname;

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const afterReload = new URL(page.url()).pathname;

const cookies = await ctx.cookies();
const session = cookies.find((c) => c.name.includes("session"));

// logout then confirm the email is remembered on the login form
await page.click(".profile");
await page.waitForTimeout(600);
await page.locator(".profile-menu button").last().click();
await page.waitForTimeout(2500);
const rememberedEmail = await page.inputValue("#login-email").catch(() => "");
const rememberChecked = await page.locator(".ng-check input").isChecked().catch(() => false);

console.log(JSON.stringify({
  wrongPassword: { stillForm, errorShown, emailKept },
  afterLogin,
  afterReload,
  cookieMaxAgeDays: session ? Math.round((session.expires - Date.now() / 1000) / 86400) : null,
  rememberedEmail,
  rememberChecked,
}, null, 2));

await browser.close();
process.exit(0);
