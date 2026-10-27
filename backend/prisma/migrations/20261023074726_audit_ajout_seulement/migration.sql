-- Le compte de l'application ne peut qu'ajouter au journal d'audit, jamais modifier ni effacer.
-- Le bloc est conditionnel : en développement, le rôle colibris_app n'existe pas et la migration passe sans rien faire.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'colibris_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "JournalAudit" FROM colibris_app;
  END IF;
END $$;