/*
  Warnings:

  - A unique constraint covering the columns `[inscriptionId,date]` on the table `Absence` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Absence_date_idx" ON "Absence"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Absence_inscriptionId_date_key" ON "Absence"("inscriptionId", "date");
