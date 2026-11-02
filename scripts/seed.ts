import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

async function main() {
  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });

  await connection.query(
    "CREATE DATABASE IF NOT EXISTS navigarde DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  );
  await connection.query("USE navigarde;");

  const db = drizzle(connection);

  const ins = (table: any, values: any) =>
    db.insert(table).values(values).execute().then((r) => Number(r[0].insertId));

  // 1. Utilisateurs
  const u1 = await ins(schema.users, {
    openId: "agent-001",
    name: "Thomas ADJÉ",
    email: "thomas.adje@navigarde.bj",
    loginMethod: "local",
    role: "admin",
    appRole: "admin",
    passwordHash: "scrypt$3895bdb07cfe64cbf703f9ad2b1a968d$1d12fcb06aecdf796b872fea73041d152cd0bf02e64cdd2a6d588868642e7640f5fd3b31cdf4a9d8aa5ce30706587a1c168b8cdf9150567ea3efcc7a932001a3",
    isActive: 1,
  });
  const u2 = await ins(schema.users, {
    openId: "agent-002",
    name: "Adélaïde HOUNDE",
    email: "adelaide.hounde@navigarde.bj",
    loginMethod: "local",
    role: "user",
    appRole: "supervisor",
    passwordHash: "scrypt$3895bdb07cfe64cbf703f9ad2b1a968d$1d12fcb06aecdf796b872fea73041d152cd0bf02e64cdd2a6d588868642e7640f5fd3b31cdf4a9d8aa5ce30706587a1c168b8cdf9150567ea3efcc7a932001a3",
    isActive: 1,
  });
  const u3 = await ins(schema.users, {
    openId: "agent-003",
    name: "Koffi DOSSA",
    email: "koffi.dossa@navigarde.bj",
    loginMethod: "local",
    role: "user",
    appRole: "agent",
    passwordHash: "scrypt$3895bdb07cfe64cbf703f9ad2b1a968d$1d12fcb06aecdf796b872fea73041d152cd0bf02e64cdd2a6d588868642e7640f5fd3b31cdf4a9d8aa5ce30706587a1c168b8cdf9150567ea3efcc7a932001a3",
    isActive: 1,
  });

  // 2. Embarcations
  const v1 = await ins(schema.vessels, {
    registrationNumber: "BJ-0421",
    name: "Pirogue N°BK-0421",
    type: "Pirogue",
    ownerName: "Société Akpakpa",
    ownerPhone: "+229 90 00 00 01",
    capacity: 12,
    lengthMeters: "8.50",
    widthMeters: "2.10",
    draftMeters: "1.20",
    enginePower: 40,
    fuelType: "Diesel",
    place: "Cotonou",
    latitude: "6.3700",
    longitude: "2.4300",
    status: "sous_surveillance",
    riskScore: 72,
  });
  const v2 = await ins(schema.vessels, {
    registrationNumber: "BJ-1187",
    name: "Vedette N°BN-1187",
    type: "Vedette",
    ownerName: "Porto Marine",
    ownerPhone: "+229 91 00 00 02",
    capacity: 30,
    lengthMeters: "14.20",
    widthMeters: "3.80",
    draftMeters: "1.80",
    enginePower: 150,
    fuelType: "Diesel",
    place: "Porto-Novo",
    latitude: "6.5000",
    longitude: "2.6200",
    status: "conforme",
    riskScore: 15,
  });
  const v3 = await ins(schema.vessels, {
    registrationNumber: "BJ-2234",
    name: "Barge N°BJ-2234",
    type: "Barge",
    ownerName: "Bénin Logistique",
    ownerPhone: "+229 92 00 00 03",
    capacity: 0,
    lengthMeters: "25.00",
    widthMeters: "6.00",
    draftMeters: "2.50",
    enginePower: 0,
    fuelType: null,
    place: "Sèmè-Kpodji",
    latitude: "6.3500",
    longitude: "2.6500",
    status: "conforme",
    riskScore: 10,
  });

  // 3. Inspections
  const i1 = await ins(schema.inspections, {
    vesselId: v1,
    agentId: u3,
    place: "Cotonou",
    passengersDetected: 14,
    lifejacketsVisible: 4,
    capacityRisk: "critique",
    hullStatus: "endommage",
    engineStatus: "bon",
    riskScore: 88,
    confidence: 92,
    recommendation: "Immobilisation immédiate - surcharge et coque endommagée",
    findings: JSON.stringify(["Surcharge passagers (14/12)", "Gilets de sauvetage insuffisants (4/14)", "Coque endommagée bâbord"]),
    uncertainty: JSON.stringify([]),
    analyzedAt: new Date(),
    analysisProvider: "Baseten/Muse Spark Open",
    status: "a_verifier",
    humanReview: "non_revue",
  });
  const i2 = await ins(schema.inspections, {
    vesselId: v2,
    agentId: u3,
    place: "Porto-Novo",
    passengersDetected: 28,
    lifejacketsVisible: 30,
    capacityRisk: "faible",
    hullStatus: "bon",
    engineStatus: "bon",
    riskScore: 12,
    confidence: 98,
    recommendation: "Conforme - aucune anomalie détectée",
    findings: JSON.stringify([]),
    uncertainty: JSON.stringify([]),
    analyzedAt: new Date(),
    analysisProvider: "Baseten/Muse Spark Open",
    status: "validee",
    humanReview: "confirmee",
    validatedBy: u2,
    validatedAt: new Date(),
  });

  // 4. Alertes
  await db.insert(schema.alerts).values({
    vesselId: v1,
    createdBy: u3,
    assignedTo: u2,
    title: "Surcharge critique pirogue BK-0421",
    description: "14 passagers détectés pour une capacité de 12. Coque endommagée. Risque de chavirage élevé.",
    place: "Cotonou",
    latitude: "6.3700",
    longitude: "2.4300",
    urgency: "detresse",
    status: "nouvelle",
    source: "ia",
  });
  await db.insert(schema.alerts).values({
    vesselId: v2,
    createdBy: u3,
    assignedTo: null,
    title: "Vedette BN-1187 - contrôle de routine OK",
    description: "Inspection de routine conforme, aucune anomalie relevée.",
    place: "Porto-Novo",
    latitude: "6.5000",
    longitude: "2.6200",
    urgency: "information",
    status: "resolue",
    source: "agent",
  });

  // 5. Bulletins maritimes
  await db.insert(schema.maritimeBulletins).values({
    title: "Forte houles sur le Golfe de Guinée",
    category: "Météo",
    maritimeZone: "Golfe de Guinée",
    importance: "urgent",
    content: "Des fortes houles sont attendues sur le Golfe de Guinée dans les prochaines 24 heures, avec des vagues pouvant atteindre 3 à 4 mètres. Éviter la navigation en haute mer.",
    attachments: JSON.stringify(["https://example.com/bulletin_048.pdf"]),
    status: "publie",
    createdBy: u2,
    publishedAt: new Date(),
  });
  await db.insert(schema.maritimeBulletins).values({
    title: "Vents violents côte béninoise",
    category: "Météo",
    maritimeZone: "Côte Béninoise",
    importance: "important",
    content: "Vents violents attendus sur la côte béninoise. Renforcer la surveillance des côtes et sécuriser les embarquements au port.",
    attachments: JSON.stringify([]),
    status: "publie",
    createdBy: u2,
    publishedAt: new Date(),
  });
  await db.insert(schema.maritimeBulletins).values({
    title: "Accès portuaire restreint à Cotonou",
    category: "Réglementation",
    maritimeZone: "Port de Cotonou",
    importance: "information",
    content: "Accès portuaire restreint à Cotonou pour maintenance du chenal de navigation. Prévoir des délais supplémentaires.",
    attachments: JSON.stringify([]),
    status: "archive",
    createdBy: u1,
  });

  console.log("✅ Seed terminé : utilisateurs, embarcations, inspections, alertes et bulletins créés.");
  await connection.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur seed:", err);
  process.exit(1);
});
