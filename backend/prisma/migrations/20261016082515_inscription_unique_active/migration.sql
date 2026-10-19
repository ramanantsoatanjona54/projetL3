-- CreateIndex
CREATE INDEX "Inscription_eleveId_anneeScolaireId_idx" ON "Inscription"("eleveId", "anneeScolaireId");

-- Un eleve ne peut avoir qu'UNE inscription non annulee par annee
CREATE UNIQUE INDEX "Inscription_eleve_annee_active_key"
  ON "Inscription" ("eleveId", "anneeScolaireId")
  WHERE "statut" <> 'annulee';