/**
 * Compteurs de limitation débités, avec deux portées :
 *
 *  - scope "ip"   : protège contre le balayage d'un compte unique par une IP
 *    (attaque ciblée) ;
 *  - scope "user" : protège un compte même si l'attaquant change d'IP
 *    (attaques distribuées). C'est la portée qui manquait : un attaquant qui
 *    change d'adresse contournait entièrement le verrou par IP.
 *
 * L'interface est volontairement asynchrone (`AsyncRateLimiter`) pour qu'un
 * backend partagé (Redis) puisse être branché sans toucher aux appelants.
 * L'implémentation livrée est en mémoire : elle protège un processus unique.
 * Voir `shared()` plus bas pour les limites multi-instances.
 */

export type RateLimitDecision = { allowed: boolean; retryAfterSeconds: number };

export interface AsyncRateLimiter {
  /** Consomme une tentative si le quota le permet. */
  consume(key: string): Promise<RateLimitDecision>;
  /** Remet le compteur à zéro après une authentification réussie. */
  reset(key: string): Promise<void>;
  /** Libère les entrées expirées (appel opportuniste). */
  prune(): Promise<void>;
}

export type MemoryLimiterOptions = {
  /** Nombre maximum d'échecs autorisés dans la fenêtre. */
  max: number;
  /** Durée de la fenêtre de comptage. */
  windowMs: number;
  /** Durée du blocage une fois la limite atteinte. */
  lockMs: number;
};

type Entry = { count: number; firstAttemptAt: number; lockedUntil: number };

export class MemoryRateLimiter implements AsyncRateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly options: MemoryLimiterOptions) {}

  async consume(key: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const current = this.entries.get(key);

    if (current && current.lockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((current.lockedUntil - now) / 1000) };
    }

    if (!current || now - current.firstAttemptAt > this.options.windowMs) {
      this.entries.set(key, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    current.count += 1;
    if (current.count > this.options.max) {
      current.lockedUntil = now + this.options.lockMs;
      return { allowed: false, retryAfterSeconds: Math.ceil(this.options.lockMs / 1000) };
    }
    this.entries.set(key, current);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async prune(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil < now && now - entry.firstAttemptAt > this.options.windowMs) this.entries.delete(key);
    }
  }

  /** Usage interne et tests : nombre d'entrées suivies. */
  size(): number {
    return this.entries.size;
  }
}
