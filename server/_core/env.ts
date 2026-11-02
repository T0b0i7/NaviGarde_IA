export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.FORGE_API_URL ?? process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.FORGE_API_KEY ?? process.env.MANUS_API_KEY ?? ""; },
};
