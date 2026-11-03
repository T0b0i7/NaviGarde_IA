import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "navigarde",
  });

  console.log("Nettoyage des fausses donnees...");

  // Desactive les contraintes temporairement pour tronquer dans l'ordre
  await connection.query("SET FOREIGN_KEY_CHECKS=0");

  const tablesToClean = [
    "vessel_positions",
    "weather_bulletins",
    "maritime_zones",
    "report_versions",
    "reports",
    "alert_history",
    "inspection_history",
    "inspection_findings",
    "inspection_images",
    "alerts",
    "inspections",
    "vessels",
    "maritime_bulletins",
    "notifications",
    "audit_events",
    "app_settings",
  ];

  for (const table of tablesToClean) {
    try {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`  OK ${table} videe`);
    } catch (e: any) {
      console.log(`  SKIP ${table}: ${e.message}`);
    }
  }

  await connection.query("SET FOREIGN_KEY_CHECKS=1");

  const [users]: any = await connection.query("SELECT id, name, email, appRole FROM users");
  console.log(`Utilisateurs conserves: ${users.length}`);
  for (const u of users) console.log(`  - ${u.id} ${u.name} (${u.email}) [${u.appRole}]`);

  await connection.end();
  console.log("Nettoyage termine. Base prete pour donnees reelles.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur nettoyage:", err);
  process.exit(1);
});
