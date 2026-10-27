/*
  Warnings:

  - A unique constraint covering the columns `[libelle,type]` on the table `Inventaire` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MouvementInventaire" ALTER COLUMN "dateMouvement" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Inventaire_libelle_type_key" ON "Inventaire"("libelle", "type");

-- CreateIndex
CREATE INDEX "MouvementInventaire_inventaireId_dateMouvement_idx" ON "MouvementInventaire"("inventaireId", "dateMouvement");
