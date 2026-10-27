# NaviGarde IA — PRODUCT.md (inféré depuis le brief de mission et le README)

**Avertissement :** ce fichier a été rédigé par inférence à partir du brief de mission (AGENTS.md) et du README existants, car aucun mécanisme d'interview utilisateur n'était disponible dans cette session. Les assumptions sont étiquetées ci-dessous.

## 1. Mission
Infrastructure numérique d'assistance multimodale et de sécurité maritime pour la gestion portuaire et la navigation artisanale au Bénin. Le smartphone d'un agent de terrain devient un outil d'inspection intelligent ; le marin dispose d'un canal d'alerte vocal accessible sans écriture ; les rapports officiels sont rédigés automatiquement puis validés par un humain.

## 2. Contraintes non négociables
- Ce n'est **pas** un RAG documentaire, **pas** de la santé, **pas** de la politique. Le produit traite des flux réels : images et audio.
- Ce n'est **pas** un simple analyseur d'image : l'enchaînement est détection → segmentation → raisonnement de sécurité → décision humaine.
- Les modèles Meta sont au cœur de la solution, pas un habillage.
- **L'IA propose, l'humain décide.** Aucun refus de départ, aucune sanction, aucun changement de statut d'alerte n'est appliqué sans un agent ou un superviseur.
- **Ne jamais inventer une donnée.** Position absente → `non précisée`. Champ manquant → `non renseigné`. L'IA ne produit jamais une coordonnée géographique de mémoire.
- Le système n'est pas un dispositif de secours officiel et doit l'afficher (renvoi vers VHF canal 16 et numéros d'urgence).

## 3. Stack
| Couche | Choix |
| --- | --- |
| Frontend | React (SPA responsive, mobile-first), Vite, Tailwind CSS, Lucide React |
| Backend | Node.js + Express, modules ES (inchangé, non modifié par ce travail) |
| Upload | Multer, contrôle du type MIME réel et de la taille |
| Base | PostgreSQL (SQLite toléré pour la démo) |
| Médias | Disque ou stockage objet, jamais en base, hors dossier public |
| PDF | Export avec empreinte SHA-256 du contenu final |

## 4. Surface visée par ce travail
**Tableau de bord Capitainerie** (mode Operate). Le visiteur complète une tâche : surveiller les alertes, lire les rapports, consulter les inspections récentes, générer/valider un rapport, télécharger le PDF réglementaire.

## 5. Règles visuelles et UX applicables (mode Operate + craft-floor)
- Une famille de typographie (sans), échelle fixe rem, ratio 1.125–1.2 entre les étapes.
- Restrained color : accents réservés aux actions primaires, sélection courante, indicateurs d'état.
- Deuxième couche neutre pour sidebar, toolbars, panneaux (légèrement plus froide/chaude que la surface de contenu).
- Chaque composant interactif : default, hover, focus, active, disabled, loading, error.
- États vide qui enseignent, pas "rien ici".
- Pas de kicker/eyebrow au-dessus d'un titre (ban).
- Pas de section numérotées (01/02/03).
- Pas de gradient texte, pas de verre/blur en décoration, pas de bordure gauche >1px en décor, pas d'ombres dures sans blur, pas de monospace comme déco, pas d'emoji à la place d'icônes, pas de police système en display.
- Contrast : body ≥4.5:1, large text ≥3:1.
- Motion : 150–250 ms, conveient l'état, pas de séquence orchestrée au chargement.

## 6. Assumptions (à confirmer)
- L'utilisateur cible du dashboard est un superviseur de capitainerie (Thomas ADJÉ, rôle superviseur).
- La langue de l'interface est le français.
- Le backend tourne sur `http://localhost:3000`, le frontend sur `http://localhost:5173` avec proxy `/api/v1`.
- Aucune donnée personnelle sensible n'est affichée au-delà de noms d'agents fictifs du jeu de démo.
