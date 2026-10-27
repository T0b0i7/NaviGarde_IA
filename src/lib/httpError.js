/**
 * Erreur applicative porteuse d'un code métier et d'un statut HTTP.
 * Toutes les routes la propagent via `next(err)` pour obtenir le format
 * d'erreur uniforme décrit dans AGENTS.md.
 */
export class HttpError extends Error {
  /**
   * @param {number} statusCode statut HTTP à renvoyer
   * @param {string} code code métier stable (ex. `INVALID_INPUT`)
   * @param {string} message message lisible par un humain
   * @param {object} [details] informations complémentaires optionnelles
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
