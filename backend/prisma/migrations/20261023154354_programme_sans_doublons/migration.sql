-- Un même texte (sans tenir compte de la casse ni des espaces en trop) ne peut pas exister deux fois au même endroit.
-- md5() évite la limite de taille des index sur les textes longs.
CREATE UNIQUE INDEX "domaine_nom_unique" ON "Domaine" ("ceintureId", lower(btrim("nom")));
CREATE UNIQUE INDEX "sous_domaine_nom_unique" ON "SousDomaine" ("domaineId", lower(btrim("nom")));
CREATE UNIQUE INDEX "competence_libelle_domaine_unique" ON "Competence" ("domaineId", md5(lower(btrim("libelle")))) WHERE "domaineId" IS NOT NULL;
CREATE UNIQUE INDEX "competence_libelle_sous_domaine_unique" ON "Competence" ("sousDomaineId", md5(lower(btrim("libelle")))) WHERE "sousDomaineId" IS NOT NULL;
CREATE UNIQUE INDEX "lecon_titre_unique" ON "Lecon" ("niveauId", "ceintureId", "matiereId", COALESCE("rubriqueId", 0), md5(lower(btrim("titre"))));