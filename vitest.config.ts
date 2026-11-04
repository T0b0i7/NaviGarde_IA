import { defineConfig } from "vitest/config";
import path from "path";
import { config as loadEnv } from "dotenv";

const templateRoot = path.resolve(import.meta.dirname);

// Charge le .env pour que les tests d'intégration utilisent exactement le
// compte MySQL de l'application (navigarde_app), jamais root en dur.
loadEnv({ path: path.resolve(templateRoot, ".env") });

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Les suites qui partagent la même base ne doivent pas se chevaucher :
    // les compteurs de limitation et les nettoyages deviendraient non déterministes.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
