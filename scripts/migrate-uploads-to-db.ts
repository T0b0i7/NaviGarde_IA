import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { storagePutExact, storageRead, uploadsDir } from "../server/storage";

/**
 * Migre les fichiers historiques de `public/uploads` vers MySQL
 * (`storage_objects`), puis vérifie la relecture octet pour octet.
 *
 *   npx tsx scripts/migrate-uploads-to-db.ts
 *
 * Le fichier disque n'est pas supprimé : `storageRead` lit la base en premier
 * et le disque en repli. Retirer les fichiers se fait après vérification.
 * Forcer le stockage MySQL pendant le script (`STORAGE_DRIVER=mysql`).
 */

async function walk(dir: string, base: string): Promise<Array<{ absolute: string; key: string }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: Array<{ absolute: string; key: string }> = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(absolute, base)));
    else if (entry.isFile()) out.push({ absolute, key: path.relative(base, absolute).split(path.sep).join("/") });
  }
  return out;
}

async function main() {
  process.env.STORAGE_DRIVER = "mysql";
  const base = uploadsDir();
  console.log(`Source       : ${base}`);
  console.log("Destination  : MySQL storage_objects\n");

  const files = await walk(base, base).catch(() => []);
  if (!files.length) {
    console.log("Aucun fichier local à migrer.");
    return;
  }

  let migrated = 0;
  let failed = 0;
  for (const file of files) {
    try {
      const { size } = await stat(file.absolute);
      const data = await readFile(file.absolute);
      // Clé EXACTE du disque : la base (inspection_images.storageKey,
      // reports.pdfStorageKey) la référence déjà telle quelle. Ajouter un
      // suffixe de hachage casserait le lien enregistrement <-> fichier.
      await storagePutExact(file.key, data, contentTypeFor(file.key));
      const roundTrip = await storageRead(file.key);
      const identical = roundTrip && roundTrip.data.equals(data);
      if (!identical) throw new Error("relecture différente de l'original");
      console.log(`  OK   ${file.key} (${size} octets)`);
      migrated += 1;
    } catch (error) {
      console.error(`  FAIL ${file.key} : ${error instanceof Error ? error.message : error}`);
      failed += 1;
    }
  }

  console.log(`\n${migrated} fichier(s) migré(s), ${failed} échec(s).`);
  if (failed) process.exit(1);
  // Sortie explicite : le pool de connexions mysql2 maintient sinon le
  // processus en vie après la fin du travail.
  process.exit(0);
}

function contentTypeFor(key: string) {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

main().catch((error) => {
  console.error("Migration impossible :", error);
  process.exit(1);
});
