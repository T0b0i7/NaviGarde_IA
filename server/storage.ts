// Stockage local uniquement (/public/uploads) — Manus Forge supprime a la demande
import path from "node:path";

function sanitizeKey(relKey: string): string {
  const cleaned = relKey.replace(/^\/+/, "").replaceAll("\\", "/");
  const normalized = path.posix.normalize(cleaned);
  if (normalized.startsWith("..") || normalized.includes("../") || path.isAbsolute(normalized)) {
    throw new Error("Invalid storage key: path traversal detected");
  }
  if (!normalized.startsWith("inspections/") && !normalized.startsWith("reports/")) {
    throw new Error("Invalid storage key: allowed prefixes are inspections/ or reports/");
  }
  if (normalized.includes("\x00")) throw new Error("Invalid storage key");
  return normalized;
}

function getForgeConfig(): never {
  throw new Error("Manus Forge supprime — stockage local actif");
}

function normalizeKey(relKey: string): string {
  return sanitizeKey(relKey);
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { dirname, join, resolve } = await import("node:path");
  const base = resolve(process.cwd(), "public", "uploads");
  const localPath = resolve(join(base, key));
  if (!localPath.startsWith(base)) throw new Error("Invalid storage key: outside base directory");
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array));
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export function uploadsDir() {
  return path.resolve(process.cwd(), "public", "uploads");
}

export async function storageRead(relKey: string): Promise<Buffer | null> {
  try {
    const key = normalizeKey(relKey);
    const base = uploadsDir();
    const localPath = path.resolve(base, key);
    if (!localPath.startsWith(base)) return null;
    const { readFile } = await import("node:fs/promises");
    return await readFile(localPath);
  } catch {
    return null;
  }
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return `/uploads/${key}`;
}
