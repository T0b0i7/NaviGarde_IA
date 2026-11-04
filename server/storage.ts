/**
 * Stockage des fichiers : photos d'inspection et PDF de rapports.
 *
 * DEUX BACKENDS
 * -------------
 *  - `mysql` (défaut tant que DATABASE_URL existe, durable) : les octets sont
 *    écrits dans la table `storage_objects`. La sauvegarde et la restauration
 *    suivent celles de la base, aucune dépendance externe. C'est le mode
 *    attendu en production et en démonstration, puisqu'un conteneur recréé ne
 *    conserve pas son disque.
 *
 *  - `local` (développement explicite) : écriture dans `public/uploads`.
 *    Pratique pour ouvrir un fichier à la main, mais **perdu au
 *    redéploiement**. Activé par `STORAGE_DRIVER=local`, ou automatiquement
 *    hors production si aucune base n'est configurée.
 *
 * Lecture : la base est consultée en premier, puis le disque. Une même base
 * peut donc afficher les fichiers déjà déposés sur disque avant la migration.
 */
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import path from "node:path";
import { storageObjects } from "../drizzle/schema";

type Driver = "mysql" | "local";

/** Préfixes autorisés : aucune écriture arbitraire dans la base. */
const ALLOWED_PREFIXES = ["inspections/", "reports/"] as const;

export type StoredObject = { key: string; url: string; size: number; sha256: string };

export function storageDriver(): Driver {
  const configured = (process.env.STORAGE_DRIVER ?? "").trim().toLowerCase();
  if (configured === "mysql") return "mysql";
  if (configured === "local") return "local";
  return process.env.DATABASE_URL ? "mysql" : "local";
}

/** Échec au démarrage plutôt qu'à la première photo d'inspection. */
export function isStorageDurable(): boolean {
  return storageDriver() === "mysql";
}

export function uploadsDir() {
  return path.resolve(process.cwd(), "public", "uploads");
}

function sanitizeKey(relKey: string): string {
  const cleaned = relKey.replace(/^\/+/, "").replaceAll("\\", "/");
  const normalized = path.posix.normalize(cleaned);
  if (normalized.startsWith("..") || normalized.includes("../") || path.isAbsolute(normalized)) {
    throw new Error("Invalid storage key: path traversal detected");
  }
  if (!ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`Invalid storage key: allowed prefixes are ${ALLOWED_PREFIXES.join(", ")}`);
  }
  if (normalized.includes("\x00")) throw new Error("Invalid storage key");
  return normalized;
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function sha256Of(data: Buffer | Uint8Array | string) {
  return createHash("sha256").update(Buffer.from(data as Uint8Array)).digest("hex");
}

/** Extrait la clé d'une URL publique `/uploads/<clé>`. */
export function keyFromUrl(url: string): string | null {
  const match = /^\/uploads\/(.+)$/.exec(url);
  return match ? match[1] : null;
}

async function getDbOrThrow() {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("Stockage MySQL indisponible : DATABASE_URL absente ou connexion non initialisée.");
  return db;
}

// -----------------------------------------------------------------------------
// Écriture
// -----------------------------------------------------------------------------

async function putToMysql(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
  const db = await getDbOrThrow();
  const digest = sha256Of(data);
  // Idempotent : rejouer le même upload ne crée pas de doublon.
  await db
    .insert(storageObjects)
    .values({ storageKey: key, contentType, sizeBytes: data.length, sha256: digest, data })
    .onDuplicateKeyUpdate({ set: { contentType, sizeBytes: data.length, sha256: digest, data } });
  return { key, url: `/uploads/${key}`, size: data.length, sha256: digest };
}

async function putToLocal(key: string, data: Buffer): Promise<StoredObject> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const base = uploadsDir();
  const localPath = path.resolve(base, key);
  if (!localPath.startsWith(base)) throw new Error("Invalid storage key: outside base directory");
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, data);
  return { key, url: `/uploads/${key}`, size: data.length, sha256: sha256Of(data) };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<StoredObject> {
  const key = appendHashSuffix(sanitizeKey(relKey));
  const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);
  if (!bytes.length) throw new Error("Refus d'écrire un fichier vide.");
  return storageDriver() === "mysql" ? putToMysql(key, bytes, contentType) : putToLocal(key, bytes);
}

/**
 * Écrit un fichier **sous une clé exacte**, sans suffixe.
 *
 * Réservé à la migration des fichiers historiques : la base référence déjà
 * `inspections/3/photo_1a2b3c4d.jpeg` par ce nom exact, et la moindre
 * variation de clé casse le lien entre l'enregistrement et le fichier.
 */
export async function storagePutExact(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<StoredObject> {
  const key = sanitizeKey(relKey);
  const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);
  if (!bytes.length) throw new Error("Refus d'écrire un fichier vide.");
  return storageDriver() === "mysql" ? putToMysql(key, bytes, contentType) : putToLocal(key, bytes);
}

// -----------------------------------------------------------------------------
// Lecture
// -----------------------------------------------------------------------------

async function readFromMysql(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  const db = await getDbOrThrow();
  const rows = await db
    .select({ data: storageObjects.data, contentType: storageObjects.contentType })
    .from(storageObjects)
    .where(eq(storageObjects.storageKey, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { data: Buffer.from(row.data), contentType: row.contentType };
}

async function readFromLocal(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const base = uploadsDir();
    const localPath = path.resolve(base, key);
    const relative = path.relative(base, localPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const data = await readFile(localPath);
    return { data, contentType: contentTypeFor(key) };
  } catch {
    return null;
  }
}

/** Lit un fichier : base d'abord, disque ensuite (fichiers historiques). */
export async function storageRead(relKey: string): Promise<{ data: Buffer; contentType: string } | null> {
  let key: string;
  try {
    key = sanitizeKey(relKey);
  } catch {
    return null;
  }
  try {
    const fromDb = await readFromMysql(key);
    if (fromDb) return fromDb;
  } catch {
    // Base indisponible : on tente le disque plutôt que d'échouer.
  }
  return readFromLocal(key);
}

/** Lecture des seuls octets, pour la génération de PDF. */
export async function storageReadBytes(relKey: string): Promise<Buffer | null> {
  return (await storageRead(relKey))?.data ?? null;
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = sanitizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export function storageGetSignedUrl(relKey: string): string {
  return `/uploads/${sanitizeKey(relKey)}`;
}

/** Type MIME déduit de l'extension, pour les fichiers relus du disque. */
export function contentTypeFor(key: string): string {
  switch (path.posix.extname(key).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

// -----------------------------------------------------------------------------
// Inventaire (migration des fichiers historiques, statistiques)
// -----------------------------------------------------------------------------

export async function listStorageKeys(): Promise<string[]> {
  const db = await getDbOrThrow();
  const rows = await db.select({ storageKey: storageObjects.storageKey }).from(storageObjects);
  return rows.map((row) => row.storageKey);
}

export async function storageStats(): Promise<{ objects: number; totalBytes: number }> {
  const db = await getDbOrThrow();
  const rows = await db.select({ sizeBytes: storageObjects.sizeBytes }).from(storageObjects);
  return { objects: rows.length, totalBytes: rows.reduce((sum, row) => sum + Number(row.sizeBytes), 0) };
}
