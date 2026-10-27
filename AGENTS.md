# NaviGarde IA — Contexte de mission

## 1. Mission

Infrastructure numérique d'assistance multimodale et de sécurité maritime pour la gestion
portuaire et la navigation artisanale au Bénin. Le smartphone d'un agent de terrain devient
un outil d'inspection intelligent ; le marin dispose d'un canal d'alerte vocal accessible
sans écriture ; les rapports officiels sont rédigés automatiquement puis validés par un humain.

- **Hackathon :** Meta Global AI Developer Hackathon 2026 — catégorie *Build for Your World*
- **Développement :** 27 octobre → 4 novembre 2026
- **Soumission :** avant 21h00 ET le 4 novembre 2026 (Cerebral Valley)
- **Porteur :** Eucher Chad Olouwatobi ABATTI, développeur Full Stack Web & Mobile
- **Meta Model API Team ID :** 3554062628092959
- **Dépôt :** public sur GitHub

## 2. Contraintes non négociables

- Ce n'est **pas** un RAG documentaire, **pas** de la santé, **pas** de la politique.
  Le produit traite des flux réels : images et audio.
- Ce n'est **pas** un simple analyseur d'image : l'enchaînement est
  détection → segmentation → raisonnement de sécurité → décision humaine.
- Les modèles Meta sont au cœur de la solution, pas un habillage.
- **L'IA propose, l'humain décide.** Aucun refus de départ, aucune sanction, aucun
  changement de statut d'alerte n'est appliqué sans un agent ou un superviseur.
- **Ne jamais inventer une donnée.** Position absente → `non précisée`. Champ manquant →
  `non renseigné`. L'IA ne produit jamais une coordonnée géographique de mémoire.
- Le système n'est pas un dispositif de secours officiel et doit l'afficher
  (renvoi vers VHF canal 16 et numéros d'urgence).

## 3. Stack

| Couche | Choix |
| --- | --- |
| Frontend | React (SPA responsive, mobile-first) |
| Backend | Node.js + Express, modules ES |
| Upload | Multer, contrôle du type MIME réel et de la taille |
| Base | PostgreSQL (SQLite toléré pour la démo) |
| Médias | Disque ou stockage objet, **jamais** en base, **hors** dossier public |
| PDF | Export avec empreinte SHA-256 du contenu final |

## 4. Architecture imposée

```text
React (SPA)  →  API Express /api/v1  →  src/ai/aiClient.js  →  services d'inférence Meta
```

Le frontend n'appelle **jamais** un modèle directement. Toute la logique métier reste
dans le backend ; seule la couche `aiClient` connaît les endpoints.

`aiClient` expose quatre fonctions, chacune avec une implémentation réelle et une
implémentation simulée (`AI_PROVIDER=mock`) :

- `segmentImage(image, mimeType)` — segmentation par catégorie
- `analyzeSafety({ image, segments, declaredCapacity })` — raisonnement de sécurité, JSON strict
- `transcribeAudio(audio, mimeType)` — transcription + langue
- `generateReport(payload)` — rédaction du rapport officiel

Raison d'être du mode simulé : développement sans quota, démo de secours si le réseau
tombe (test T14), adaptation rapide si un endpoint diffère de la documentation.

## 5. Modèles IA (noms à confirmer jour 1)

| Rôle | Modèle annoncé | Usage |
| --- | --- | --- |
| Segmentation | SAM 3.1 | masques : personne, gilet, moteur, coque, bouée |
| Raisonnement sécurité | Muse Spark | comptages, anomalies, niveau de risque, classification d'alerte |
| Audio | Muse Voice Transcribe | transcription des appels de détresse |
| Rédaction | Muse Wonder | rapports d'infraction / sauvetage |

Les noms viennent du business plan. À vérifier dans la doc officielle du hackathon
(endpoints exacts, formats, quotas, hébergement Baseten/Modal). Tout écart est consigné
dans `docs/ecarts.md` et absorbé **uniquement** dans `aiClient`.

## 6. Persistance

Accès via `src/config/db.js` : un seul `pg.Pool` pour tout le processus, jamais de
client créé par requête, requêtes toujours paramétrées (`$1`, `$2`…).

- Schéma : `database/init.sql`, idempotent, appliqué par `npm run db:init`.
- Écritures métier : passer par un dépôt (`src/repositories/...`), jamais depuis une route.
- Dégradation : hors production, une base injoignable bascule sur un repli mémoire et la
  réponse l'annonce (`meta.persistence = 'memory'`). En production, `DB_REQUIRED=true`
  par défaut : on renvoie 503 plutôt que de laisser croire à un enregistrement réussi.
- Un rapport validé ne doit jamais disparaître : `reports.inspection_id` est en
  `ON DELETE RESTRICT`.

## 7. Règles de risque (module inspection)

Configurables via variables d'environnement, évaluées du plus grave au moins grave :

| Niveau | Condition |
| --- | --- |
| `CRITIQUE` | passagers > 120 % de la capacité déclarée, **ou** gilets < 50 % des passagers |
| `ELEVE` | passagers > capacité déclarée, **ou** gilets < 80 % des passagers |
| `MOYEN` | gilets < 100 % des passagers, **ou** anomalie de coque suspectée |
| `FAIBLE` | aucune anomalie |

Codes machine en ASCII (`ELEVE`), libellés accentués à l'affichage.
`needs_review = true` dès que la confiance IA < `CONFIDENCE_THRESHOLD` (0,6 par défaut).

## 8. Conventions de code

- Code et commentaires en **français**, identifiants et routes en anglais.
- Un fichier = une responsabilité. Pas de logique métier dans les routes.
- Routes REST sous `/api/v1/...`, JSON uniquement.
- Format d'erreur uniforme :
  `{ "status": "error", "code": "...", "message": "..." }`
- Succès : `{ "status": "success", ... }`
- Validation systématique des entrées avec `zod` (y compris les réponses de l'IA).
- Secrets uniquement via `dotenv` ; `.env.example` maintenu à jour ; `.env` jamais commité.
- Chaque résultat IA stocke le modèle, sa version et l'horodatage.
- Le prompt de sécurité interdit d'inventer : élément non visible → `null` ou
  `"non déterminable"`.

## 9. Priorités (règle de sacrifice)

Si le temps manque, sacrifier dans cet ordre : carte des alertes → bulletin audio → 2FA →
export CSV. **Ne jamais sacrifier** : inspection de bout en bout, alerte vocale, rapport PDF.

## 10. État d'avancement

- [x] Squelette backend, `/health`, abstraction `aiClient` avec mocks
- [x] `POST /api/v1/inspect` (segmentation → analyse → règles de risque)
- [x] Persistance PostgreSQL (`pg.Pool`, `database/init.sql`, dépôt inspections)
- [ ] Authentification JWT + RBAC (EF-01 à EF-03)
- [x] Module alerte vocale + centre d'alertes (API)
- [ ] Centre d'alertes React
- [x] Module rapport (génération, hash SHA-256, validation, verrouillage)
- [x] Export PDF (pdfkit, QR de vérification, sceau SHA-256)
- [x] Versioning des rapports (v2, v3… clonage automatique après validation)
- [ ] Tableau de bord React
