import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "node:path";

/**
 * Connexion de test, alignée sur la configuration réelle de l'application.
 *
 * Avant : les tests se connectaient en `root` sans mot de passe, alors que
 * l'application devait tourner avec un compte dédié. Un test qui passe grâce à
 * des privilèges que la production n'accorde pas ne prouve rien.
 *
 * Désormais : `DATABASE_URL` du `.env` (ou de l'environnement) est la seule
 * source. Si elle est absente, les tests d'intégration sont ignorés au lieu
 * d'inventer une connexion privilégiée.
 */

dotenv.config({ path: path.resolve(import.meta.dirname, "..", ".env") });

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Options mysql2 dérivées de DATABASE_URL, pour les connexions hors Drizzle. */
export function connectionOptions() {
  const url = new URL(process.env.DATABASE_URL!);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
  };
}

export async function testConnection(): Promise<mysql.Connection> {
  return mysql.createConnection({ ...connectionOptions(), database: connectionOptions().database ?? "navigarde" });
}

/** Échoue explicitement si le compte de test est un superutilisateur. */
export function assertLeastPrivilege() {
  if (!hasDatabase()) return;
  const user = connectionOptions().user.toLowerCase();
  if (user === "root") {
    throw new Error(
      "Les tests tournent sur le compte root. Configurez DATABASE_URL avec le compte applicatif dédié (navigarde_app).",
    );
  }
}
