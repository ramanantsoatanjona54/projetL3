/*
  Warnings:

  - A unique constraint covering the columns `[salleId,niveauId,anneeScolaireId,jourSemaine,heureDebut]` on the table `EmploiDuTemps` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EmploiDuTemps_salleId_anneeScolaireId_idx";

-- DropIndex
DROP INDEX "EmploiDuTemps_salleId_anneeScolaireId_jourSemaine_heureDebu_key";

-- CreateIndex
CREATE INDEX "EmploiDuTemps_salleId_niveauId_anneeScolaireId_idx" ON "EmploiDuTemps"("salleId", "niveauId", "anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "EmploiDuTemps_salleId_niveauId_anneeScolaireId_jourSemaine__key" ON "EmploiDuTemps"("salleId", "niveauId", "anneeScolaireId", "jourSemaine", "heureDebut");
