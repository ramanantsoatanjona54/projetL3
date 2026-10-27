-- Masque, à l'écriture, toute valeur dont la clé évoque un secret, quel que soit le code appelant.
CREATE OR REPLACE FUNCTION journal_masquer_json(j jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  resultat jsonb;
  cle text;
  valeur jsonb;
BEGIN
  IF j IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(j) = 'object' THEN
    resultat := '{}'::jsonb;
    FOR cle, valeur IN SELECT key, value FROM jsonb_each(j) LOOP
      IF cle ~* '(mot.?de.?passe|passw|hash|secret|token|jeton|cookie|authorization|totp|secours|empreinte|^code$|^cle$)' THEN
        resultat := resultat || jsonb_build_object(cle, '[masqué]'::text);
      ELSE
        resultat := resultat || jsonb_build_object(cle, journal_masquer_json(valeur));
      END IF;
    END LOOP;
    RETURN resultat;
  ELSIF jsonb_typeof(j) = 'array' THEN
    RETURN COALESCE((SELECT jsonb_agg(journal_masquer_json(e)) FROM jsonb_array_elements(j) AS e), '[]'::jsonb);
  END IF;
  RETURN j;
END;
$$;

CREATE OR REPLACE FUNCTION journal_masquer_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.details := journal_masquer_json(NEW.details);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journal_masquer ON "JournalAudit";
CREATE TRIGGER journal_masquer BEFORE INSERT ON "JournalAudit"
FOR EACH ROW EXECUTE FUNCTION journal_masquer_trigger();

-- Nettoyage des lignes déjà écrites
UPDATE "JournalAudit" SET details = journal_masquer_json(details) WHERE details IS NOT NULL;