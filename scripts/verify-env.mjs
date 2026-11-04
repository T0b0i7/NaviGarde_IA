#!/usr/bin/env node
/**
 * Vérifie la configuration de déploiement AVANT de démarrer l'application.
 *
 * Usage : node scripts/verify-env.mjs
 *
 * Sort en code 1 si la configuration est insuffisante pour la production.
 * Aucun secret n'est affiché : seuls des noms de variables et des booléens.
 */

import "dotenv/config";

const errors = [];
const warnings = [];
const info = [];

const isProduction = process.env.NODE_ENV === "production";
const FORBIDDEN_USERS = new Set(["root", "admin", "mysql", "superuser"]);

// --- Base de données ---------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  errors.push("DATABASE_URL absente.");
} else {
  try {
    const url = new URL(databaseUrl);
    const user = decodeURIComponent(url.username || "");
    info.push(`Base : ${url.hostname}:${url.port || 3306}/${url.pathname.replace(/^\//, "")}`);
    info.push(`Compte MySQL : ${user}`);

    if (url.protocol !== "mysql:") errors.push(`Protocole ${url.protocol} non supporté (attendu mysql:).`);
    if (FORBIDDEN_USERS.has(user.toLowerCase())) {
      errors.push(`Le compte « ${user} » est un superutilisateur. Utilisez navigarde_app (voir DEPLOYMENT.md).`);
    }
    if (!decodeURIComponent(url.password || "")) errors.push("Mot de passe MySQL vide.");
  } catch {
    errors.push("DATABASE_URL n'est pas une URL valide.");
  }
}

if (isProduction && process.env.DATABASE_URL?.includes("localhost")) {
  warnings.push("La production pointe sur localhost : vérifiez que la base est sur le même hôte.");
}

// --- Sessions ----------------------------------------------------------------
const jwt = process.env.MANUS_JWT_SECRET?.trim() ?? "";
if (!jwt) warnings.push("MANUS_JWT_SECRET absent : seule l'authentification locale fonctionne.");
else if (jwt.length < 32) errors.push(`MANUS_JWT_SECRET trop court (${jwt.length} < 32).`);
else info.push("Secret de session présent, longueur suffisante.");

// --- IA ----------------------------------------------------------------------
if (!process.env.BASETEN_API_KEY?.trim()) {
  const message = "BASETEN_API_KEY absente : l'analyse IA sera indisponible (erreur explicite, pas de simulation).";
  if (isProduction) warnings.push(message);
  else info.push(message);
}

// --- Observabilité -----------------------------------------------------------
if (isProduction && !process.env.METRICS_TOKEN?.trim()) {
  warnings.push("METRICS_TOKEN absent : /api/metrics restera inaccessible (401) en production.");
}

// --- Rapport -----------------------------------------------------------------
console.log("=== Vérification de la configuration NaviGarde IA ===\n");
for (const line of info) console.log(`  info    ${line}`);
for (const line of warnings) console.log(`  avert.  ${line}`);
for (const line of errors) console.log(`  ERREUR  ${line}`);

console.log("");
if (errors.length) {
  console.error(`${errors.length} erreur(s) bloquante(s). Corrigez avant de déployer.`);
  process.exit(1);
}
console.log("Configuration acceptée.");
