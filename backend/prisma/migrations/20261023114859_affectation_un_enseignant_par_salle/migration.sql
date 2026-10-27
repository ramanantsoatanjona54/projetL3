-- Deux enseignants en poste ne peuvent pas être titulaires de la même salle
CREATE UNIQUE INDEX "personnel_un_enseignant_par_salle"
  ON "Personnel" ("salleAffecteeId")
  WHERE "salleAffecteeId" IS NOT NULL AND "autorisationEnseigner" = true AND "dateDepart" IS NULL;