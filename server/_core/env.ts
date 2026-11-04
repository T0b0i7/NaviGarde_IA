export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return ""; },
  get forgeApiKey() { return ""; },
  /** Indique si l'analyse IA réelle est configurée (jamais la clé elle-même). */
  get hasBasetenKey() { return Boolean(process.env.BASETEN_API_KEY?.trim()); },
};
