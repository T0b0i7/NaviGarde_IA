# NaviGarde IA — installation, sécurité et déploiement

## Prérequis

- Node.js compatible avec le projet et `pnpm` 10.18.
- MySQL accessible par `DATABASE_URL`.
- Un espace de stockage Manus Forge configuré pour les images et les PDF.
- Une clé serveur Baseten uniquement si l’analyse Muse Spark est activée par la configuration du projet.

## Installation locale

```bash
pnpm install
cp .env.example .env # si le fichier d’exemple est fourni par l’environnement
pnpm db:migrate
pnpm check
pnpm test
pnpm dev
```

L’application écoute sur `PORT` ou `3000`. Les migrations Drizzle versionnées dans `drizzle/` sont partagées par les environnements : ne pas exécuter de suppression de données sur la base de démonstration.

## Variables sensibles

Les secrets restent côté serveur et ne doivent jamais être ajoutés à `client/src`, à Git ou à une valeur publique Vite. Les variables principales sont `DATABASE_URL`, les variables d’authentification Manus, les variables de stockage et, si le fournisseur externe est activé, la clé Baseten. En production, utiliser le gestionnaire de secrets de la plateforme.

## Sécurité implémentée

- Validation des entrées par Zod dans les procédures tRPC.
- Requêtes SQL paramétrées par Drizzle/MySQL2.
- Sessions HTTP-only, Secure et SameSite=None pour le Preview HTTPS intégré.
- Mots de passe hashés avec scrypt et comparaison résistante au timing.
- Limitation locale à cinq échecs de connexion par couple IP/e-mail sur quinze minutes.
- RBAC contrôlé côté serveur pour administrateur, superviseur, agent et observateur.
- Validation MIME, extension contrôlée et limite de 10 Mo pour les images.
- En-têtes `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy`.
- React échappe les contenus rendus ; aucun HTML métier n’est injecté avec `dangerouslySetInnerHTML`.
- Audit des connexions, comptes, paramètres, bulletins et opérations sensibles.

Le cookie de session est volontairement `SameSite=None` car Preview est chargé dans une iframe cross-site. En production, conserver HTTPS et ajouter une protection CSRF dédiée si une interface externe au domaine de l’application est introduite.

## Vérification qualité

```bash
pnpm check
pnpm test
pnpm build
```

Les tests couvrent actuellement l’authentification locale, la déconnexion, l’intégration de session plateforme et les utilitaires de sécurité. Les tests de parcours navigateur doivent être exécutés dans l’environnement de Preview avec un compte de démonstration configuré.

## Fonctionnalités persistantes

Les modules inspections, images, analyse IA, anomalies, alertes, rapports PDF, versions de rapports, embarcations, bulletins maritimes, utilisateurs, notifications, audit et paramètres utilisent MySQL et les services de stockage. Une analyse IA non configurée doit être présentée comme indisponible ; aucune réponse simulée ne doit être présentée comme une analyse réelle.

## Déploiement

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

Le healthcheck non authentifié est `GET /api/health`. Les fichiers durables ne doivent pas être écrits dans le conteneur : utiliser MySQL et le stockage objet. Vérifier après déploiement la connexion, le rôle Observateur, l’upload d’image, la génération PDF, les notifications et les migrations appliquées.
