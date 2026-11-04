/**
 * Sérialisation de sortie : ce qui quitte l'API.
 *
 * Certains champs sont internes au serveur et n'ont aucune utilité côté client.
 * Les exposer, même à un utilisateur authentifié, élargit inutilement la
 * surface d'attaque (une clé de stockage peut servir à deviner ou contourner
 * des URLs signées).
 *
 * Règle : toute valeur ajoutée à la liste ci-dessous est retirée des réponses
 * API de manière centralisée, pour que les futurs appelants restent protégés.
 */

const INTERNAL_REPORT_FIELDS = ["pdfStorageKey"] as const;

/** Retire les champs internes d'un rapport. */
export function publicReport<T extends Record<string, unknown>>(report: T | undefined) {
  if (!report) return report;
  const safe: Record<string, unknown> = { ...report };
  for (const field of INTERNAL_REPORT_FIELDS) delete safe[field];
  return safe as Omit<T, (typeof INTERNAL_REPORT_FIELDS)[number]>;
}

/** Retire les champs internes d'une liste de rapports. */
export function publicReports<T extends Record<string, unknown>>(reports: T[]) {
  return reports.map((report) => publicReport(report)!);
}
