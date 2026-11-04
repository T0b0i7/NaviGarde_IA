import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { adminConnection } from "./adminDb";

/**
 * Script de maintenance ponctuel : réapplique un hash scrypt connu sur trois
 * comptes. Déprécié — préférer localAuth.resetPassword ou un compte de test
 * créé par scripts/create-role-accounts.ts.
 *
 * Le hash codé en dur correspond à un mot de passe de démonstration ; ce
 * script n'a de sens qu'en local.
 */
const HASH = "scrypt$3895bdb07cfe64cbf703f9ad2b1a968d$1d12fcb06aecdf796b872fea73041d152cd0bf02e64cdd2a6d588868642e7640f5fd3b31cdf4a9d8aa5ce30706587a1c168b8cdf9150567ea3efcc7a932001a3";

async function main() {
  const connection = await adminConnection();
  const db = drizzle(connection);
  for (const email of ["thomas.adje@navigarde.bj", "adelaide.hounde@navigarde.bj", "koffi.dossa@navigarde.bj"]) {
    await db.update(schema.users).set({ passwordHash: HASH }).where(eq(schema.users.email, email));
    console.log("Mis à jour:", email);
  }
  await connection.end();
  console.log("Terminé - mots de passe scrypt mis à jour.");
}

main().catch((err) => { console.error("Erreur:", err); process.exit(1); });
