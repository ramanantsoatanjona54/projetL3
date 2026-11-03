/*
  Warnings:

  - A unique constraint covering the columns `[nif]` on the table `Personnel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[numeroStatistique]` on the table `Personnel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TypePersonnel" AS ENUM ('SALARIE', 'CONSULTANT');

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "nif" TEXT,
ADD COLUMN     "numeroStatistique" TEXT,
ADD COLUMN     "typePersonnel" "TypePersonnel" NOT NULL DEFAULT 'SALARIE';

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_nif_key" ON "Personnel"("nif");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_numeroStatistique_key" ON "Personnel"("numeroStatistique");
