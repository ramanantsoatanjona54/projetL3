/*
  Warnings:

  - A unique constraint covering the columns `[salleId,anneeScolaireId,jourSemaine,heureDebut]` on the table `EmploiDuTemps` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "EmploiDuTemps_salleId_anneeScolaireId_idx" ON "EmploiDuTemps"("salleId", "anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "EmploiDuTemps_salleId_anneeScolaireId_jourSemaine_heureDebu_key" ON "EmploiDuTemps"("salleId", "anneeScolaireId", "jourSemaine", "heureDebut");
