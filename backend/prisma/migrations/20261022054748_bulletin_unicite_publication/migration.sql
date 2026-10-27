/*
  Warnings:

  - A unique constraint covering the columns `[inscriptionId,periode]` on the table `Bulletin` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Bulletin" ADD COLUMN     "datePublication" TIMESTAMP(3),
ADD COLUMN     "publie" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Bulletin_inscriptionId_periode_key" ON "Bulletin"("inscriptionId", "periode");
