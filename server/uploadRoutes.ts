import type { Express, Request, Response } from "express";
import { storageRead } from "./storage";
import { logger } from "./_core/logger";

/**
 * Service des fichiers stockés (`/uploads/<clé>`).
 *
 * Les octets viennent de MySQL (`storage_objects`) via `storageRead`, qui
 * bascule sur le disque local si la base ne contient pas la clé. Un conteneur
 * recréé sert donc toujours les photos et PDF : rien ne dépend plus de son
 * système de fichiers.
 *
 * Sécurité :
 *  - clé validée par `storageRead` (préfixes `inspections/` et `reports/`,
 *    refus du `..`) ;
 *  - `X-Content-Type-Options: nosniff` et Content-Type figé par extension ;
 *  - `Content-Disposition: inline` pour les images, `attachment` pour tout le
 *    reste, afin qu'un fichier déposé ne soit jamais interprété comme du HTML ;
 *  - cache navigateur immuable : chaque clé contient un suffixe aléatoire.
 */
export function registerUploadRoutes(app: Express) {
  app.get("/uploads/*", async (req: Request, res: Response) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).type("text/plain").send("Clé de stockage absente");
      return;
    }

    try {
      const object = await storageRead(key);
      if (!object) {
        res.status(404).type("text/plain").send("Fichier introuvable");
        return;
      }

      const inline = object.contentType.startsWith("image/");
      res.setHeader("Content-Type", object.contentType);
      res.setHeader("Content-Length", String(object.data.length));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${key.split("/").pop()}"`);
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.end(object.data);
    } catch (error) {
      logger.error({ err: error, key }, "Upload read failed");
      res.status(500).type("text/plain").send("Lecture du fichier impossible");
    }
  });
}
