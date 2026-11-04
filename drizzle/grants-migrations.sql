-- =============================================================================
-- NaviGarde IA — privilèges du compte de migration (CI / déploiement)
-- -----------------------------------------------------------------------------
-- Séparation des responsabilités :
--   - navigarde_app        : SELECT/INSERT/UPDATE/DELETE, ne modifie pas le schéma
--   - navigarde_migrator   : crée/altère les tables, utilisé uniquement par
--                            `pnpm db:migrate` en CI ou au déploiement
--
-- Exécution :
--   mysql -u root -p < drizzle/grants-migrations.sql
-- =============================================================================

SET @navigarde_db   = IFNULL(@navigarde_db,   'navigarde');
SET @navigarde_user = IFNULL(@navigarde_user, 'navigarde_migrator');
SET @navigarde_host = IFNULL(@navigarde_host, 'localhost');

-- CREATE USER est volontairement laissé à l'administrateur, qui choisit le
-- mot de passe hors dépôt :
--   CREATE USER 'navigarde_migrator'@'localhost' IDENTIFIED BY '<secret>';

SET @sql = CONCAT(
  'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON ',
  @navigarde_db, '.* TO ', '''', @navigarde_user, '''', '@', '''', @navigarde_host, ''''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

FLUSH PRIVILEGES;

SELECT user, host FROM mysql.user WHERE user = @navigarde_user;
SHOW GRANTS FOR CONCAT(@navigarde_user, '@', @navigarde_host);
