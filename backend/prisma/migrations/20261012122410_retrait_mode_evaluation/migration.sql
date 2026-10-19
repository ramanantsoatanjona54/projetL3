/*
  Warnings:

  - You are about to drop the column `modeEvaluation` on the `Classe` table. All the data in the column will be lost.
  - You are about to drop the column `libelle` on the `ExamenBlanc` table. All the data in the column will be lost.
  - You are about to drop the column `matiereId` on the `ExamenBlanc` table. All the data in the column will be lost.
  - You are about to drop the column `examenId` on the `NoteExamen` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `ParentEleve` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `ParentEleve` table. All the data in the column will be lost.
  - You are about to drop the column `prenom` on the `ParentEleve` table. All the data in the column will be lost.
  - You are about to drop the column `telephone` on the `ParentEleve` table. All the data in the column will be lost.
  - You are about to drop the column `parentEleveId` on the `RemarqueParent` table. All the data in the column will be lost.
  - You are about to drop the column `parentEleveId` on the `RendezVous` table. All the data in the column will be lost.
  - You are about to drop the column `parentEleveId` on the `Utilisateur` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[numeroInscription]` on the table `Eleve` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[niveauId,anneeScolaireId,numero]` on the table `ExamenBlanc` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[disciplineId,inscriptionId]` on the table `NoteExamen` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[parentId,eleveId]` on the table `ParentEleve` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cin]` on the table `Personnel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[parentId]` on the table `Utilisateur` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `anneeScolaireId` to the `ExamenBlanc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `niveauId` to the `ExamenBlanc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero` to the `ExamenBlanc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `disciplineId` to the `NoteExamen` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentId` to the `ParentEleve` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentId` to the `RemarqueParent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentId` to the `RendezVous` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ExamenBlanc" DROP CONSTRAINT "ExamenBlanc_matiereId_fkey";

-- DropForeignKey
ALTER TABLE "NoteExamen" DROP CONSTRAINT "NoteExamen_examenId_fkey";

-- DropForeignKey
ALTER TABLE "RemarqueParent" DROP CONSTRAINT "RemarqueParent_parentEleveId_fkey";

-- DropForeignKey
ALTER TABLE "RendezVous" DROP CONSTRAINT "RendezVous_parentEleveId_fkey";

-- DropForeignKey
ALTER TABLE "Utilisateur" DROP CONSTRAINT "Utilisateur_parentEleveId_fkey";

-- DropIndex
DROP INDEX "NoteExamen_examenId_inscriptionId_key";

-- DropIndex
DROP INDEX "Utilisateur_parentEleveId_key";

-- AlterTable
ALTER TABLE "Classe" DROP COLUMN "modeEvaluation";

-- AlterTable
ALTER TABLE "Eleve" ADD COLUMN     "assurance" TEXT,
ADD COLUMN     "assuranceExpiration" TIMESTAMP(3),
ADD COLUMN     "dateInscription" TIMESTAMP(3),
ADD COLUMN     "dossiersManquants" TEXT,
ADD COLUMN     "email1" TEXT,
ADD COLUMN     "email2" TEXT,
ADD COLUMN     "numeroInscription" TEXT,
ADD COLUMN     "professionMere" TEXT,
ADD COLUMN     "professionPere" TEXT,
ADD COLUMN     "quartier" TEXT,
ADD COLUMN     "taille" DOUBLE PRECISION,
ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "ExamenBlanc" DROP COLUMN "libelle",
DROP COLUMN "matiereId",
ADD COLUMN     "anneeScolaireId" INTEGER NOT NULL,
ADD COLUMN     "niveauId" INTEGER NOT NULL,
ADD COLUMN     "numero" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "NoteExamen" DROP COLUMN "examenId",
ADD COLUMN     "disciplineId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ParentEleve" DROP COLUMN "email",
DROP COLUMN "nom",
DROP COLUMN "prenom",
DROP COLUMN "telephone",
ADD COLUMN     "parentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "autorisationEnseigner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "banque" TEXT,
ADD COLUMN     "cin" TEXT,
ADD COLUMN     "dateDepart" TIMESTAMP(3),
ADD COLUMN     "dateNaissance" TIMESTAMP(3),
ADD COLUMN     "dateRetraite" TIMESTAMP(3),
ADD COLUMN     "indemniteTransportJour" DECIMAL(10,2),
ADD COLUMN     "lieuAffectation" TEXT,
ADD COLUMN     "numeroCnaps" TEXT,
ADD COLUMN     "salleAffecteeId" INTEGER,
ADD COLUMN     "sexe" TEXT,
ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "RemarqueParent" DROP COLUMN "parentEleveId",
ADD COLUMN     "parentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RendezVous" DROP COLUMN "parentEleveId",
ADD COLUMN     "parentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Utilisateur" DROP COLUMN "parentEleveId",
ADD COLUMN     "parentId" INTEGER;

-- DropEnum
DROP TYPE "ModeEvaluation";

-- CreateTable
CREATE TABLE "Parent" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteLecon" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "leconId" INTEGER NOT NULL,
    "niveau" "NiveauCompetence" NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "dateSaisie" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteLecon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamenBlancDiscipline" (
    "id" SERIAL NOT NULL,
    "examenBlancId" INTEGER NOT NULL,
    "matiereId" INTEGER NOT NULL,
    "coefficient" INTEGER NOT NULL,

    CONSTRAINT "ExamenBlancDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteLecon_inscriptionId_leconId_key" ON "NoteLecon"("inscriptionId", "leconId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamenBlancDiscipline_examenBlancId_matiereId_key" ON "ExamenBlancDiscipline"("examenBlancId", "matiereId");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_numeroInscription_key" ON "Eleve"("numeroInscription");

-- CreateIndex
CREATE UNIQUE INDEX "ExamenBlanc_niveauId_anneeScolaireId_numero_key" ON "ExamenBlanc"("niveauId", "anneeScolaireId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "NoteExamen_disciplineId_inscriptionId_key" ON "NoteExamen"("disciplineId", "inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentEleve_parentId_eleveId_key" ON "ParentEleve"("parentId", "eleveId");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_cin_key" ON "Personnel"("cin");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_parentId_key" ON "Utilisateur"("parentId");

-- AddForeignKey
ALTER TABLE "ParentEleve" ADD CONSTRAINT "ParentEleve_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_salleAffecteeId_fkey" FOREIGN KEY ("salleAffecteeId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLecon" ADD CONSTRAINT "NoteLecon_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLecon" ADD CONSTRAINT "NoteLecon_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "Lecon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLecon" ADD CONSTRAINT "NoteLecon_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlanc" ADD CONSTRAINT "ExamenBlanc_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "Niveau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlanc" ADD CONSTRAINT "ExamenBlanc_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlancDiscipline" ADD CONSTRAINT "ExamenBlancDiscipline_examenBlancId_fkey" FOREIGN KEY ("examenBlancId") REFERENCES "ExamenBlanc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlancDiscipline" ADD CONSTRAINT "ExamenBlancDiscipline_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExamen" ADD CONSTRAINT "NoteExamen_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "ExamenBlancDiscipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemarqueParent" ADD CONSTRAINT "RemarqueParent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
