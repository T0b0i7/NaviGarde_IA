/**
 * Accès aux données des utilisateurs (EF-01, EF-02, EF-03).
 *
 * Principe : un seul pool pg partagé, requêtes paramétrées, dégradation
 * mémoire hors production identique au reste du dépôt.
 */

import { randomUUID } from 'node:crypto';
import { DB_REQUIRED, DbUnavailableError, query, withTransaction } from '../config/db.js';
import { HttpError } from '../lib/httpError.js';

const MEMORY_LIMIT = 300;
const memoryStore = new Map();

function degradable(error) {
  if (error instanceof DbUnavailableError) return true;
  return error instanceof HttpError && error.code === 'FOREIGN_KEY_VIOLATION';
}

function keep(record) {
  if (memoryStore.size >= MEMORY_LIMIT) {
    memoryStore.delete(memoryStore.keys().next().value);
  }
  memoryStore.set(record.id, record);
}

/**
 * Crée un utilisateur (admin uniquement).
 * L'email est unique : un doublon lève une erreur 409.
 */
export async function createUser(record) {
  try {
    const { rows } = await query(
      `INSERT INTO users (id, nom, email, password_hash, role, actif)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nom, email, role, actif, created_at`,
      [record.id, record.nom, record.email, record.password_hash, record.role, record.actif]
    );
    return { persisted: 'postgres', record: rows[0] };
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    const clone = { ...record, id: record.id ?? randomUUID(), created_at: new Date().toISOString() };
    keep(clone);
    return { persisted: 'memory', record: clone, reason: error.code };
  }
}

/**
 * Trouve un utilisateur par email (utilisé au login).
 * Retourne le hash de mot de passe pour comparaison côté service.
 */
export async function findByEmail(email) {
  try {
    const { rows } = await query(
      `SELECT id, nom, email, password_hash, role, actif, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    return [...memoryStore.values()].find((u) => u.email === email) ?? null;
  }
}

/**
 * Trouve un utilisateur par id.
 */
export async function findById(id) {
  try {
    const { rows } = await query(
      `SELECT id, nom, email, role, actif, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    return memoryStore.get(id) ?? null;
  }
}

/**
 * Liste les utilisateurs (admin).
 */
export async function listUsers() {
  try {
    const { rows } = await query(
      `SELECT id, nom, email, role, actif, created_at
       FROM users ORDER BY created_at DESC`
    );
    return { persisted: 'postgres', records: rows };
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    return { persisted: 'memory', records: [...memoryStore.values()] };
  }
}

/**
 * Met à jour un utilisateur (rôle, actif, nom, email).
 * L'email reste unique.
 */
export async function updateUser(id, changes) {
  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    setClauses.push(`${key} = $${idx}`);
    params.push(value);
    idx += 1;
  }

  if (setClauses.length === 0) {
    return { persisted: 'postgres', updated: false };
  }

  setClauses.push(`updated_at = now()`);
  params.push(id);

  try {
    const { rowCount } = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id`,
      params
    );
    return { persisted: 'postgres', updated: rowCount > 0 };
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    const record = memoryStore.get(id);
    if (!record) return { persisted: 'memory', updated: false };
    const updated = { ...record, ...changes, updated_at: new Date().toISOString() };
    memoryStore.set(id, updated);
    return { persisted: 'memory', updated: true };
  }
}

/**
 * Désactive un utilisateur (soft delete) — admin uniquement.
 */
export async function deactivateUser(id) {
  return updateUser(id, { actif: false });
}
