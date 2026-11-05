import mysql from "mysql2/promise";
import { hashPassword } from "../server/_core/localAuth";

const ACCOUNTS = [
  { name: "Agent Test", email: "agent@navigarde.bj", appRole: "agent", passwordEnv: "NAVIGARDE_TEST_AGENT_PASSWORD" },
  { name: "Superviseur Test", email: "superviseur@navigarde.bj", appRole: "supervisor", passwordEnv: "NAVIGARDE_TEST_SUPERVISOR_PASSWORD" },
  { name: "Admin Test", email: "admin@navigarde.bj", appRole: "admin", passwordEnv: "NAVIGARDE_TEST_ADMIN_PASSWORD" },
  { name: "Observateur Test", email: "observateur@navigarde.bj", appRole: "observer", passwordEnv: "NAVIGARDE_TEST_OBSERVER_PASSWORD" },
] as const;

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL absent : renseignez une base dédiée au développement ou aux tests.");

  const passwords = ACCOUNTS.map((account) => {
    const password = process.env[account.passwordEnv];
    if (!password || password.length < 12) {
      throw new Error(`${account.passwordEnv} doit être défini et contenir au moins 12 caractères.`);
    }
    return password;
  });

  const url = new URL(raw);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  });

  try {
    for (const [index, account] of ACCOUNTS.entries()) {
      const passwordHash = await hashPassword(passwords[index]);
      const [existing]: any = await connection.query("SELECT id FROM users WHERE email = ?", [account.email]);
      const role = account.appRole === "admin" ? "admin" : "user";

      if (existing.length) {
        await connection.query(
          "UPDATE users SET name = ?, passwordHash = ?, appRole = ?, role = ?, isActive = 1, loginMethod = 'local' WHERE email = ?",
          [account.name, passwordHash, account.appRole, role, account.email],
        );
        console.log(`Compte de test mis à jour : ${account.appRole} (${account.email})`);
      } else {
        const openId = `test_${account.appRole}_${Date.now()}`;
        await connection.query(
          "INSERT INTO users (openId, name, email, loginMethod, role, appRole, passwordHash, isActive) VALUES (?, ?, 'local', ?, ?, ?, ?, 1)",
          [openId, account.name, account.email, role, account.appRole, passwordHash],
        );
        console.log(`Compte de test créé : ${account.appRole} (${account.email})`);
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Échec de création des comptes de test.", error instanceof Error ? error.message : "Erreur inconnue.");
  process.exitCode = 1;
});
