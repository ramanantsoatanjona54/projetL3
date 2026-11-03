/*
  Warnings:

  - A unique constraint covering the columns `[eleveId,lienParente]` on the table `ParentEleve` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ParentEleve_eleveId_lienParente_key" ON "ParentEleve"("eleveId", "lienParente");
