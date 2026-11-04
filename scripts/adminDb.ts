import mysql from "mysql2/promise";

/**
 * Scripts d'administration destructifs : connexion explicite via
 * ADMIN_DATABASE_URL (compte de migration ou administrateur), jamais root en
 * dur et jamais le compte applicatif.
 */
export function adminConnection() {
  const raw = process.env.ADMIN_DATABASE_URL ?? process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("ADMIN_DATABASE_URL (ou MIGRATION_DATABASE_URL) requis pour un script d'administration.");
  const url = new URL(raw);
  const user = decodeURIComponent(url.username);
  console.log(`[admin] compte utilisé : ${user}`);
  if (user === "root") console.log("[admin] ATTENTION : exécution avec un superutilisateur.");
  return mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user,
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
  });
}
