/*
  Warnings:

  - A unique constraint covering the columns `[nom,anneeScolaireId]` on the table `Salle` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Salle_nom_anneeScolaireId_key" ON "Salle"("nom", "anneeScolaireId");
