-- CreateEnum
CREATE TYPE "TypeElementBulletin" AS ENUM ('DISCIPLINE', 'RUBRIQUE', 'LIGNE');

-- AlterEnum
ALTER TYPE "NiveauCompetence" ADD VALUE 'NA';

-- CreateTable
CREATE TABLE "ElementBulletin" (
    "id" SERIAL NOT NULL,
    "semestreId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "type" "TypeElementBulletin" NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archiveLe" TIMESTAMP(3),

    CONSTRAINT "ElementBulletin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationBulletin" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "niveau" "NiveauCompetence" NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "dateSaisie" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationBulletin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElementBulletin_semestreId_parentId_idx" ON "ElementBulletin"("semestreId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementBulletin_semestreId_parentId_libelle_key" ON "ElementBulletin"("semestreId", "parentId", "libelle");

-- CreateIndex
CREATE INDEX "EvaluationBulletin_elementId_idx" ON "EvaluationBulletin"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationBulletin_inscriptionId_elementId_key" ON "EvaluationBulletin"("inscriptionId", "elementId");

-- AddForeignKey
ALTER TABLE "ElementBulletin" ADD CONSTRAINT "ElementBulletin_semestreId_fkey" FOREIGN KEY ("semestreId") REFERENCES "Semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementBulletin" ADD CONSTRAINT "ElementBulletin_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ElementBulletin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationBulletin" ADD CONSTRAINT "EvaluationBulletin_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationBulletin" ADD CONSTRAINT "EvaluationBulletin_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "ElementBulletin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationBulletin" ADD CONSTRAINT "EvaluationBulletin_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une seule discipline de meme nom par semestre (parentId NULL n'est pas controle par l'unique de Prisma)
CREATE UNIQUE INDEX "ElementBulletin_discipline_unique" ON "ElementBulletin" ("semestreId", lower("libelle")) WHERE "parentId" IS NULL;
