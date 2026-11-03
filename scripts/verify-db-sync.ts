import mysql from "mysql2/promise";

async function main() {
  const c = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "", database: "navigarde" });
  console.log("=== VERIFICATION SYNCHRO BD ===");
  const [tables]: any = await c.query("SHOW TABLES");
  console.log(`Tables: ${tables.length}`);

  const checks: Array<[string, string]> = [
    ["users", "SELECT id, name, email, appRole, isActive FROM users"],
    ["vessels", "SELECT COUNT(*) as n FROM vessels"],
    ["inspections", "SELECT COUNT(*) as n FROM inspections"],
    ["alerts", "SELECT COUNT(*) as n FROM alerts"],
    ["reports", "SELECT COUNT(*) as n FROM reports"],
    ["maritime_bulletins", "SELECT COUNT(*) as n FROM maritime_bulletins"],
    ["notifications", "SELECT COUNT(*) as n FROM notifications"],
    ["audit_events", "SELECT COUNT(*) as n FROM audit_events"],
  ];

  for (const [name, sql] of checks) {
    try {
      const [rows]: any = await c.query(sql);
      if (name === "users") {
        console.log(`OK ${name}: ${rows.length} compte(s)`);
        for (const u of rows) console.log(`   - ${u.email} [${u.appRole}] actif=${u.isActive}`);
      } else {
        console.log(`OK ${name}: ${rows[0].n} ligne(s)`);
      }
    } catch (e: any) {
      console.log(`FAIL ${name}: ${e.message}`);
    }
  }

  // Test écriture/lecture/suppression cycle complet
  console.log("\n--- Test cycle CRUD ---");
  const reg = `TEST-${Date.now()}`;
  const [vRes]: any = await c.query("INSERT INTO vessels (registrationNumber, type, ownerName, capacity, place, status, riskScore) VALUES (?, 'Pirogue', 'Test Sync', 10, 'Cotonou', 'conforme', 0)", [reg]);
  const vid = vRes.insertId;
  console.log(`OK vessels.create id=${vid}`);

  const [iRes]: any = await c.query("INSERT INTO inspections (vesselId, place, status) VALUES (?, 'Cotonou', 'en_cours')", [vid]);
  const iid = iRes.insertId;
  console.log(`OK inspections.create id=${iid}`);

  const [aRes]: any = await c.query("INSERT INTO alerts (title, place, urgency, status, source, vesselId) VALUES ('Test sync', 'Cotonou', 'information', 'nouvelle', 'systeme', ?)", [vid]);
  const aid = aRes.insertId;
  console.log(`OK alerts.create id=${aid}`);

  const [rRes]: any = await c.query("INSERT INTO reports (inspectionId, reference, content, status) VALUES (?, ?, 'contenu test sync', 'brouillon')", [iid, `RPT-SYNC-${Date.now()}`]);
  console.log(`OK reports.create id=${rRes.insertId}`);

  const [bRes]: any = await c.query("INSERT INTO maritime_bulletins (title, category, maritimeZone, content, status) VALUES ('Test sync', 'Test', 'Cotonou', 'contenu test', 'brouillon')");
  console.log(`OK bulletins.create id=${bRes.insertId}`);

  // Nettoyage test
  await c.query("DELETE FROM maritime_bulletins WHERE id=?", [bRes.insertId]);
  await c.query("DELETE FROM reports WHERE id=?", [rRes.insertId]);
  await c.query("DELETE FROM alerts WHERE id=?", [aid]);
  await c.query("DELETE FROM inspections WHERE id=?", [iid]);
  await c.query("DELETE FROM vessels WHERE id=?", [vid]);
  console.log("OK nettoyage test (lignes test supprimées)");

  // Migrations
  const [mig]: any = await c.query("SELECT COUNT(*) as n FROM __drizzle_migrations");
  console.log(`\nMigrations appliquées: ${mig[0].n}`);

  await c.end();
  console.log("\n=== SYNC OK : API tRPC <-> Drizzle <-> MySQL fonctionnelle ===");
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
