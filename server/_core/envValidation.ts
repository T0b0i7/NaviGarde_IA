/**
 * Validation des variables d'environnement au démarrage.
 *
 * Objectif : un serveur configuré à moitié doit refuser de démarrer plutôt que
 * d'échouer silencieusement à la première requête métier.
 *
 * - En production, les secrets manquants ou les connexions MySQL en `root`
 *   font échouer le démarrage (`fail-fast`).
 * - En développement, les mêmes problèmes produisent des avertissements
 *   explicites sans bloquer le travail.
 *
 * Aucun secret n'est jamais journalisé : seuls les noms de variables et un
 * diagnostic court apparaissent dans les logs.
 */

export type Severity = "error" | "warning";

export type EnvIssue = { variable: string; severity: Severity; message: string };

export type EnvReport = {
  ok: boolean;
  issues: EnvIssue[];
  /** Valeurs normalisées, jamais les secrets eux-mêmes. */
  summary: {
    databaseUser: string | null;
    databaseHost: string | null;
    databaseName: string | null;
    hasBasetenKey: boolean;
    hasManusJwtSecret: boolean;
    nodeEnv: string;
  };
};

/** Un compte MySQL applicatif ne doit jamais être `root`. */
const FORBIDDEN_DB_USERS = new Set(["root", "admin", "mysql", "superuser"]);

/** Longueur minimale acceptable pour un secret de signature de session. */
const MIN_SECRET_LENGTH = 32;

function parseDatabaseUrl(raw: string) {
  try {
    const url = new URL(raw);
    const user = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");
    return {
      protocol: url.protocol.replace(":", ""),
      user,
      password,
      host: url.hostname,
      port: url.port || "3306",
      database: url.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

export function inspectEnvironment(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const issues: EnvIssue[] = [];
  const isProduction = env.NODE_ENV === "production";

  // --- Base de données ------------------------------------------------------
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  let db: ReturnType<typeof parseDatabaseUrl> = null;

  if (!databaseUrl) {
    issues.push({
      variable: "DATABASE_URL",
      severity: "error",
      message: "Absente : aucune persistance possible, l'application ne peut pas fonctionner.",
    });
  } else {
    db = parseDatabaseUrl(databaseUrl);
    if (!db) {
      issues.push({
        variable: "DATABASE_URL",
        severity: "error",
        message: "Format invalide : attendu mysql://utilisateur:motdepasse@hote:port/base.",
      });
    } else {
      if (db.protocol !== "mysql") {
        issues.push({
          variable: "DATABASE_URL",
          severity: "error",
          message: `Protocole « ${db.protocol} » non supporté : seule MySQL/MariaDB est prise en charge.`,
        });
      }
      if (!db.database) {
        issues.push({
          variable: "DATABASE_URL",
          severity: "error",
          message: "Nom de base absent de l'URL.",
        });
      }
      if (!db.user) {
        issues.push({
          variable: "DATABASE_URL",
          severity: "error",
          message: "Utilisateur absent de l'URL.",
        });
      }
      if (FORBIDDEN_DB_USERS.has(db.user.toLowerCase())) {
        issues.push({
          variable: "DATABASE_URL",
          severity: "error",
          message: `Le compte « ${db.user} » est un superutilisateur MySQL. Utilisez le compte applicatif dédié (navigarde_app) créé avec les seuls droits SELECT/INSERT/UPDATE/DELETE.`,
        });
      }
      if (!db.password) {
        issues.push({
          variable: "DATABASE_URL",
          severity: isProduction ? "error" : "warning",
          message: "Le compte MySQL est sans mot de passe. Acceptable uniquement en local.",
        });
      }
      if (!isProduction && !["localhost", "127.0.0.1", "::1"].includes(db.host)) {
        issues.push({
          variable: "DATABASE_URL",
          severity: "warning",
          message: `La base de développement pointe vers un hôte distant (${db.host}) : vérifiez qu'il ne s'agit pas de la production.`,
        });
      }
    }
  }

  // --- Signature des sessions (OAuth Manus) --------------------------------
  const jwtSecret = env.MANUS_JWT_SECRET?.trim() ?? "";
  if (jwtSecret && jwtSecret.length < MIN_SECRET_LENGTH) {
    issues.push({
      variable: "MANUS_JWT_SECRET",
      severity: isProduction ? "error" : "warning",
      message: `Secret de signature trop court (${jwtSecret.length} caractères, minimum ${MIN_SECRET_LENGTH}).`,
    });
  }

  // --- Analyse IA ----------------------------------------------------------
  const basetenKey = env.BASETEN_API_KEY?.trim() ?? "";
  if (!basetenKey && isProduction) {
    issues.push({
      variable: "BASETEN_API_KEY",
      severity: "warning",
      message: "Absente : les fonctions d'analyse IA resteront indisponibles (elles renverront une erreur explicite, pas une simulation).",
    });
  }

  // --- Divers --------------------------------------------------------------
  if (isProduction && env.PORT && !Number.isInteger(Number(env.PORT))) {
    issues.push({ variable: "PORT", severity: "error", message: "Valeur non numérique." });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
    summary: {
      databaseUser: db?.user ?? null,
      databaseHost: db ? `${db.host}:${db.port}` : null,
      databaseName: db?.database || null,
      hasBasetenKey: Boolean(basetenKey),
      hasManusJwtSecret: Boolean(jwtSecret),
      nodeEnv: env.NODE_ENV ?? "development",
    },
  };
}

/**
 * Valide l'environnement et lève une erreur si le démarrage doit être refusé.
 * Retourne le rapport pour que l'appelant puisse journaliser le résumé.
 */
export function assertEnvironment(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const report = inspectEnvironment(env);
  if (!report.ok) {
    const details = report.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `  - ${issue.variable} : ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration invalide, démarrage refusé :\n${details}`);
  }
  return report;
}
