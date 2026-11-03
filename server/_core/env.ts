export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return ""; },
  get forgeApiKey() { return ""; },
};
