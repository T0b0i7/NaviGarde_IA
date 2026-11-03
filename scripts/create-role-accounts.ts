import mysql from "mysql2/promise";
import { hashPassword } from "../server/_core/localAuth";

const ACCOUNTS = [
  { name: "Agent Test", email: "agent@navigarde.bj", password: "Agent12345678!", appRole: "agent" },
  { name: "Superviseur Test", email: "superviseur@navigarde.bj", password: "Superviseur123!", appRole: "supervisor" },
  { name: "Admin Test", email: "admin@navigarde.bj", password: "Admin12345678!", appRole: "admin" },
  { name: "Observateur Test", email: "observateur@navigarde.bj", password: "Observateur123!", appRole: "observer" },
] as const;

async function main() {
  const c = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "", database: "navigarde" });
  console.log("Création des comptes par rôle...\n");
  for (const a of ACCOUNTS) {
    const hash = await hashPassword(a.password);
    const [existing]: any = await c.query("SELECT id FROM users WHERE email=?", [a.email]);
    if (existing.length) {
      await c.query("UPDATE users SET name=?, passwordHash=?, appRole=?, role=?, isActive=1, loginMethod='local' WHERE email=?", [a.name, hash, a.appRole, a.appRole === "admin" ? "admin" : "user", a.email]);
      console.log(`MAJ ${a.appRole} id=${existing[0].id} ${a.email}`);
    } else {
      const openId = `test_${a.appRole}_${Date.now()}`;
      const [res]: any = await c.query("INSERT INTO users (openId, name, email, loginMethod, role, appRole, passwordHash, isActive) VALUES (?, ?, ?, 'local', ?, ?, ?, 1)", [openId, a.name, a.email, a.appRole === "admin" ? "admin" : "user", a.appRole, hash]);
      console.log(`CREE ${a.appRole} id=${res.insertId} ${a.email}`);
    }
  }
  const [rows]: any = await c.query("SELECT id, name, email, appRole, isActive FROM users ORDER BY id");
  console.log(`\nTotal utilisateurs: ${rows.length}`);
  for (const u of rows) console.log(`  #${u.id} ${u.email} [${u.appRole}] actif=${u.isActive}`);
  console.log("\n=== IDENTIFIANTS À TESTER ===");
  for (const a of ACCOUNTS) console.log(`${a.appRole.toUpperCase()}  ${a.email}  /  ${a.password}`);
  await c.end();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
