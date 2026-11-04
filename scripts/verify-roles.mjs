import { chromium } from "playwright-core";

/**
 * Parcours navigateur des quatre rôles.
 *
 *   node scripts/verify-roles.mjs [--base http://localhost:3000] [--screenshots]
 *
 * Prérequis : un serveur qui tourne (`pnpm dev` ou `pnpm start`) et la base
 * accessible. Le script vérifie, pour chaque rôle :
 *   - que la connexion réussit et aboutit sur le tableau de bord ;
 *   - que le menu latéral n'expose que les entrées autorisées (RBAC) ;
 *   - que les routes interdites redirigent vers /forbidden ;
 *   - qu'aucune erreur console ni requête réseau en échec n'apparaît.
 *
 * Sortie : code 1 si un contrôle échoue.
 */

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const BASE = baseIndex >= 0 ? args[baseIndex + 1] : "http://localhost:3000";
const SCREENSHOTS = args.includes("--screenshots");
const FAILURE_DIR = args.includes("--screenshots") ? "artifacts" : null;

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const ROLES = [
  {
    key: "admin",
    email: "admin@navigarde.bj",
    password: "Admin12345678!",
    // Chemins autorisés par shared/rbac.ts
    allowed: ["/", "/inspections", "/alertes", "/rapports", "/embarcations", "/bulletins", "/utilisateurs", "/audit", "/parametres"],
    forbidden: [],
  },
  {
    key: "supervisor",
    email: "superviseur@navigarde.bj",
    password: "Superviseur123!",
    allowed: ["/", "/inspections", "/alertes", "/rapports", "/embarcations", "/bulletins", "/audit"],
    forbidden: ["/utilisateurs", "/parametres"],
  },
  {
    key: "agent",
    email: "agent@navigarde.bj",
    password: "Agent12345678!",
    allowed: ["/", "/inspections", "/alertes", "/embarcations", "/bulletins"],
    forbidden: ["/rapports", "/audit", "/utilisateurs", "/parametres"],
  },
  {
    key: "observer",
    email: "observateur@navigarde.bj",
    password: "Observateur123!",
    allowed: ["/", "/rapports", "/embarcations", "/bulletins"],
    forbidden: ["/inspections", "/alertes", "/audit", "/utilisateurs", "/parametres"],
  },
];

const results = [];
let failures = 0;

function record(role, check, ok, detail = "") {
  results.push({ role, check, ok, detail });
  if (!ok) failures += 1;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${role} · ${check}${detail ? ` — ${detail}` : ""}`);
}

async function waitForIdle(page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function runRole(browser, role) {
  console.log(`\n=== ${role.key} (${role.email}) ===`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  // Les appels API volontaires du script produisent leurs propres erreurs HTTP
  // (400/405/403 attendus) : ils ne doivent pas compter comme bruit du site.
  let intentionalProbes = false;
  const isOwnProbe = (text) => intentionalProbes && (/\/api\/trpc\//.test(text) || /py\.from|TRPCClientError/.test(text));

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // L'erreur console associée à une sonde volontaire est ignorée aussi.
    if (intentionalProbes && /Failed to load resource/.test(text)) return;
    if (isOwnProbe(text)) return;
    // Une requête refusée (401/403) déclenche une entrée console du navigateur
    // (« Failed to load resource ») : c'est le comportement attendu du RBAC.
    if (/Failed to load resource: the server responded with a status of (401|403|429)/.test(text)) return;
    if (/\[API (Query|Mutation) Error\]/.test(text) && /FORBIDDEN|UNAUTHORIZED|403|401/.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("requestfailed", (req) => {
    if (/ERR_ABORTED/.test(req.failure()?.errorText ?? "")) return;
    if (intentionalProbes && /\/api\/trpc\//.test(req.url())) return;
    // Images distantes bloquées par le navigateur (pas de réseau de test).
    if (/images\.unsplash\.com/.test(req.url())) return;
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500 && !(intentionalProbes && /\/api\/trpc\//.test(res.url()))) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  // --- Connexion ---
  await page.goto(`${BASE}/connexion`, { waitUntil: "domcontentloaded" });
  await waitForIdle(page);
  await page.waitForSelector("#login-email", { timeout: 20_000 });
  await page.fill("#login-email", role.email);
  await page.fill("#login-password", role.password);
  await page.click('button[type="submit"]');
  await waitForIdle(page, 2500);

  const landedOn = new URL(page.url()).pathname;
  record(role.key, "connexion aboutit sur une page interne", landedOn !== "/connexion", `arrivée sur ${landedOn}`);

  // Le jeton CSRF doit être présent et lisible (nécessaire aux mutations).
  const csrfCookie = (await context.cookies()).find((c) => c.name === "navigarde_csrf");
  record(role.key, "cookie CSRF posé et lisible", Boolean(csrfCookie) && !csrfCookie.httpOnly, csrfCookie ? `${csrfCookie.value.length} car.` : "absent");

  // --- Navigation autorisée ---
  for (const path of role.allowed) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await waitForIdle(page);
    const current = new URL(page.url()).pathname;
    const ok = current === path;
    record(role.key, `accès autorisé ${path}`, ok, ok ? "" : `redirigé vers ${current}`);
    if (SCREENSHOTS && path === "/") {
      await page.screenshot({ path: `artifacts/role-${role.key}-dashboard.png`, fullPage: false });
    }
  }

  // --- Navigation interdite ---
  for (const path of role.forbidden) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await waitForIdle(page);
    const current = new URL(page.url()).pathname;
    record(role.key, `accès refusé ${path}`, current === "/forbidden", current === "/forbidden" ? "" : `resté sur ${current}`);
  }

  // --- Contrôle direct de l'API (défense en profondeur) ---
  // Les mutations passent par POST ; les lectures par GET.
  intentionalProbes = true;
  for (const { procedure, method } of [
    { procedure: "data.vessels.create", method: "POST" },
    { procedure: "localAuth.users.list", method: "GET" },
  ]) {
    const status = await page.evaluate(
      async ({ proc, verb }) => {
        const csrf = document.cookie.match(/navigarde_csrf=([^;]*)/)?.[1] ?? "";
        const init =
          verb === "GET"
            ? { method: "GET", credentials: "include", headers: { "x-csrf-token": csrf } }
            : {
                method: "POST",
                headers: { "content-type": "application/json", "x-csrf-token": csrf },
                body: JSON.stringify({ json: {} }),
                credentials: "include",
              };
        const res = await fetch(`/api/trpc/${proc}`, init);
        return res.status;
      },
      { proc: procedure, verb: method },
    );
    // Rôle non autorisé : 401/403. Rôle autorisé : refus de validation (400)
    // ou de méthode (405), jamais un refus d'autorisation.
    const privileged = procedure === "localAuth.users.list" ? role.key === "admin" : role.key !== "observer";
    const ok = privileged ? ![401, 403].includes(status) : [401, 403].includes(status);
    record(role.key, `API ${procedure} (${method})`, ok, `HTTP ${status}`);
  }

  // --- Mutation sans jeton CSRF : doit être refusée ---
  const withoutCsrf = await page.evaluate(async () => {
    const res = await fetch("/api/trpc/data.notifications.markAllRead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: null }),
      credentials: "include",
    });
    return res.status;
  });
  record(role.key, "mutation sans jeton CSRF refusée", withoutCsrf === 403, `HTTP ${withoutCsrf}`);
  intentionalProbes = false;

  // --- Hygiène ---
  record(role.key, "aucune erreur console", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  record(role.key, "aucune requête en échec", failedRequests.length === 0, failedRequests.slice(0, 2).join(" | "));

  await context.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const role of ROLES) {
    try {
      await runRole(browser, role);
    } catch (error) {
      // Un échec de parcours ne doit pas masquer les rôles suivants.
      record(role.key, "parcours complet", false, error instanceof Error ? error.message.split("\n")[0] : String(error));
      if (FAILURE_DIR) await browser.contexts()[0]?.pages()[0]?.screenshot({ path: `${FAILURE_DIR}/echec-${role.key}.png` }).catch(() => {});
    }
  }
} finally {
  await browser.close();
}

const total = results.length;
console.log(`\n${total - failures}/${total} contrôles réussis.`);
if (failures) {
  console.log("Échecs :");
  for (const r of results.filter((r) => !r.ok)) console.log(`  - ${r.role} · ${r.check} — ${r.detail}`);
  process.exit(1);
}
process.exit(0);
