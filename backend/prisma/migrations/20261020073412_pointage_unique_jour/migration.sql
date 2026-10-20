/*
  Warnings:

  - A unique constraint covering the columns `[personnelId,date]` on the table `Pointage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Pointage_date_idx" ON "Pointage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Pointage_personnelId_date_key" ON "Pointage"("personnelId", "date");
