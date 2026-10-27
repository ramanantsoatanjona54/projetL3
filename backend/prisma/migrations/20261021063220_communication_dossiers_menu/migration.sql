/*
  Warnings:

  - A unique constraint covering the columns `[empreinte]` on the table `DossierPartage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[periodeMenuId,date]` on the table `JourMenu` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DossierPartage" ADD COLUMN     "deposeParId" INTEGER,
ADD COLUMN     "empreinte" TEXT,
ADD COLUMN     "mime" TEXT,
ADD COLUMN     "nomOriginal" TEXT,
ADD COLUMN     "taille" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "DossierPartage_empreinte_key" ON "DossierPartage"("empreinte");

-- CreateIndex
CREATE INDEX "JourMenu_date_idx" ON "JourMenu"("date");

-- CreateIndex
CREATE UNIQUE INDEX "JourMenu_periodeMenuId_date_key" ON "JourMenu"("periodeMenuId", "date");

-- AddForeignKey
ALTER TABLE "DossierPartage" ADD CONSTRAINT "DossierPartage_deposeParId_fkey" FOREIGN KEY ("deposeParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
