/**
 * Service d'authentification (EF-01, EF-02, EF-03, EF-04).
 *
 * - hachage des mots de passe avec bcrypt (facteur de coût 10) ;
 * - JWT signé, durée courte (JWT_EXPIRES_IN, défaut 30 min) ;
 * - déconnexion automatique après inactivité gérée côté client (EF-04) ;
 * - aucun secret ne circule en clair : seul le hash est stocké.
 */

import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HttpError } from '../lib/httpError.js';
import {
  createUser,
  findByEmail,
  findById,
  listUsers,
  updateUser,
  deactivateUser,
} from '../repositories/userRepository.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1800'; // 30 min par défaut

if (!JWT_SECRET || JWT_SECRET === 'changez_moi_en_production_avec_openssl_rand_hex_32') {
  // En développement on accepte, en production on doit alerter.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET doit être défini en production.');
  }
}

/**
 * Hache un mot de passe en clair.
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Vérifie un mot de passe en clair contre un hash.
 */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Génère un JWT pour un utilisateur.
 * @returns {string}
 */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, subject: 'access' }
  );
}

/**
 * Vérifie et décode un JWT.
 * @returns {{ sub: string, email: string, role: string } | null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Connexion : email + mot de passe → retourne { user, token }.
 * Échec → 401 (pas de différenciation email inconnu / mauvais mot de passe).
 */
export async function login({ email, password }) {
  const user = await findByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects.');
  }
  if (!user.actif) {
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'Compte désactivé. Contactez un administrateur.');
  }

  const token = signToken(user);

  return {
    status: 'success',
    token,
    expires_in: Number(JWT_EXPIRES_IN),
    user: {
      id: user.id,
      nom: user.nom,
      email: user.email,
      role: user.role,
      actif: user.actif,
    },
  };
}

/**
 * Crée un compte utilisateur (admin uniquement, EF-03).
 */
export async function register({ nom, email, password, role = 'agent' }) {
  const existing = await findByEmail(email);
  if (existing) {
    throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Cet email est déjà utilisé.');
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  const result = await createUser({ id, nom, email, password_hash: passwordHash, role, actif: true });
  if (!result.record) {
    throw new HttpError(500, 'USER_CREATION_FAILED', 'Impossible de créer le compte.');
  }

  return {
    status: 'success',
    user: {
      id: result.record.id,
      nom: result.record.nom,
      email: result.record.email,
      role: result.record.role,
      actif: result.record.actif,
    },
  };
}

/**
 * Retourne le profil de l'utilisateur courant (EF-01, GET /auth/me).
 */
export async function getProfile(userId) {
  const user = await findById(userId);
  if (!user) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  }
  return { status: 'success', user };
}

/**
 * Liste tous les utilisateurs (admin, EF-03).
 */
export async function getAllUsers() {
  return listUsers();
}

/**
 * Modifie un utilisateur (admin, EF-03) : rôle, actif, nom, email.
 */
export async function modifyUser(userId, { nom, email, role, actif }) {
  const changes = {};
  if (nom !== undefined) changes.nom = nom;
  if (email !== undefined) changes.email = email;
  if (role !== undefined) changes.role = role;
  if (actif !== undefined) changes.actif = actif;

  const result = await updateUser(userId, changes);
  if (!result.updated) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  }

  return { status: 'success', user_id: userId };
}

/**
 * Désactive un compte (admin, EF-03).
 */
export async function disableUser(userId) {
  const result = await deactivateUser(userId);
  if (!result.updated) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  }
  return { status: 'success', user_id: userId, actif: false };
}
