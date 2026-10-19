/*
  Warnings:

  - The values [CERTIFICAT_TRAVAIL] on the enum `TypeCertificat` will be removed. If these variants are still used in the database, this will fail.
  - The values [SCOLAIRE,INFORMATIQUE] on the enum `TypeInventaire` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `inscriptionId` on the `Absence` table. All the data in the column will be lost.
  - You are about to drop the column `saisiParId` on the `Absence` table. All the data in the column will be lost.
  - You are about to drop the column `semestreId` on the `Bulletin` table. All the data in the column will be lost.
  - You are about to drop the column `dateEmission` on the `CertificatTravail` table. All the data in the column will be lost.
  - You are about to drop the column `semestreId` on the `Domaine` table. All the data in the column will be lost.
  - You are about to drop the column `dateDepot` on the `DossierPartage` table. All the data in the column will be lost.
  - You are about to drop the column `fichierUrl` on the `DossierPartage` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `DossierPartage` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `EmploiDuTemps` table. All the data in the column will be lost.
  - You are about to drop the column `enseignantId` on the `EnseignantMatiere` table. All the data in the column will be lost.
  - You are about to drop the column `salleId` on the `EnseignantMatiere` table. All the data in the column will be lost.
  - You are about to drop the column `anneeScolaireId` on the `ExamenBlanc` table. All the data in the column will be lost.
  - You are about to drop the column `niveauId` on the `ExamenBlanc` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `ExamenBlanc` table. All the data in the column will be lost.
  - You are about to drop the column `dateEmission` on the `FicheDePaie` table. All the data in the column will be lost.
  - You are about to drop the column `deductions` on the `FicheDePaie` table. All the data in the column will be lost.
  - You are about to alter the column `salaireBrut` on the `FicheDePaie` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `salaireNet` on the `FicheDePaie` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to drop the column `anneeScolaireId` on the `Frais` table. All the data in the column will be lost.
  - You are about to alter the column `montant` on the `Frais` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to drop the column `dateAjout` on the `Inventaire` table. All the data in the column will be lost.
  - You are about to drop the column `etat` on the `Inventaire` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `Inventaire` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `dessert` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `entree` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `periodeId` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `platPrincipal` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `JournalActivite` table. All the data in the column will be lost.
  - You are about to drop the column `examenBlancId` on the `NoteExamen` table. All the data in the column will be lost.
  - You are about to drop the column `matiereId` on the `NoteExamen` table. All the data in the column will be lost.
  - You are about to alter the column `note` on the `NoteExamen` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(4,2)`.
  - You are about to drop the column `date` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `datePaiement` on the `Paiement` table. All the data in the column will be lost.
  - You are about to drop the column `montantPaye` on the `Paiement` table. All the data in the column will be lost.
  - The `moisConcerne` column on the `Paiement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `tauxPenalite` on the `Paiement` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(4,2)`.
  - You are about to drop the column `dateDebut` on the `PeriodeMenu` table. All the data in the column will be lost.
  - You are about to drop the column `dateFin` on the `PeriodeMenu` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `PeriodeMenu` table. All the data in the column will be lost.
  - You are about to drop the column `fonction` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Publication` table. All the data in the column will be lost.
  - You are about to drop the column `visiblePublic` on the `Publication` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `RemarqueParent` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `RemarqueParent` table. All the data in the column will be lost.
  - You are about to drop the column `traitee` on the `RemarqueParent` table. All the data in the column will be lost.
  - You are about to drop the column `anneeScolaireId` on the `RemiseFraternite` table. All the data in the column will be lost.
  - You are about to drop the column `montantEcolage` on the `RemiseFraternite` table. All the data in the column will be lost.
  - You are about to drop the column `rangEnfant` on the `RemiseFraternite` table. All the data in the column will be lost.
  - You are about to drop the column `dateSouhaitee` on the `RendezVous` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `RendezVous` table. All the data in the column will be lost.
  - You are about to drop the column `personnelId` on the `RendezVous` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `Semestre` table. All the data in the column will be lost.
  - You are about to drop the column `ordre` on the `Semestre` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `TypeFrais` table. All the data in the column will be lost.
  - You are about to drop the `Programme` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[libelle]` on the table `AnneeScolaire` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nom]` on the table `Classe` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ordre]` on the table `Classe` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[matricule]` on the table `Eleve` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personnelId,matiereId]` on the table `EnseignantMatiere` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nom]` on the table `Matiere` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[matiereId,niveauId]` on the table `MatiereCoefficient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[classeId,nom]` on the table `Niveau` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inscriptionId,competenceId]` on the table `NoteCompetence` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[examenId,inscriptionId]` on the table `NoteExamen` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[matricule]` on the table `Personnel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rang]` on the table `RemiseFraternite` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nom]` on the table `Salle` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[niveauId,numero]` on the table `Semestre` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `TypeFrais` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eleveId` to the `Absence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateDebut` to the `AnneeScolaire` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateFin` to the `AnneeScolaire` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periode` to the `Bulletin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cycle` to the `Classe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modeEvaluation` to the `Classe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ceintureId` to the `Domaine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cheminFichier` to the `DossierPartage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `matricule` to the `Eleve` table without a default value. This is not possible if the table is not empty.
  - Added the required column `anneeScolaireId` to the `EmploiDuTemps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jourSemaine` to the `EmploiDuTemps` table without a default value. This is not possible if the table is not empty.
  - Made the column `heureDebut` on table `EmploiDuTemps` required. This step will fail if there are existing NULL values in that column.
  - Made the column `heureFin` on table `EmploiDuTemps` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `personnelId` to the `EnseignantMatiere` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `ExamenBlanc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `libelle` to the `ExamenBlanc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `matiereId` to the `ExamenBlanc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `annee` to the `FicheDePaie` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `mois` on the `FicheDePaie` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `libelle` to the `Inventaire` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contenu` to the `JourMenu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodeMenuId` to the `JourMenu` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `jourSemaine` on the `JourMenu` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `examenId` to the `NoteExamen` table without a default value. This is not possible if the table is not empty.
  - Added the required column `anneeScolaireId` to the `Paiement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `datePrevue` to the `Paiement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montant` to the `Paiement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lienParente` to the `ParentEleve` table without a default value. This is not possible if the table is not empty.
  - Added the required column `libelle` to the `PeriodeMenu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `matricule` to the `Personnel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poste` to the `Personnel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentEleveId` to the `RemarqueParent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `utilisateurId` to the `RemarqueParent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montant` to the `RemiseFraternite` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rang` to the `RemiseFraternite` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateHeure` to the `RendezVous` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentEleveId` to the `RendezVous` table without a default value. This is not possible if the table is not empty.
  - Added the required column `utilisateurId` to the `RendezVous` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero` to the `Semestre` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `TypeFrais` table without a default value. This is not possible if the table is not empty.
  - Added the required column `libelle` to the `TypeFrais` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModeEvaluation" AS ENUM ('COMPETENCE', 'NOTE');

-- AlterEnum
ALTER TYPE "StatutRendezVous" ADD VALUE 'TERMINE';

-- AlterEnum
BEGIN;
CREATE TYPE "TypeCertificat_new" AS ENUM ('TRAVAIL', 'CONTRAT');
ALTER TABLE "CertificatTravail" ALTER COLUMN "type" TYPE "TypeCertificat_new" USING ("type"::text::"TypeCertificat_new");
ALTER TYPE "TypeCertificat" RENAME TO "TypeCertificat_old";
ALTER TYPE "TypeCertificat_new" RENAME TO "TypeCertificat";
DROP TYPE "public"."TypeCertificat_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TypeInventaire_new" AS ENUM ('MOBILIER', 'FOURNITURE', 'AUTRE');
ALTER TABLE "Inventaire" ALTER COLUMN "type" TYPE "TypeInventaire_new" USING ("type"::text::"TypeInventaire_new");
ALTER TYPE "TypeInventaire" RENAME TO "TypeInventaire_old";
ALTER TYPE "TypeInventaire_new" RENAME TO "TypeInventaire";
DROP TYPE "public"."TypeInventaire_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Absence" DROP CONSTRAINT "Absence_inscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Absence" DROP CONSTRAINT "Absence_saisiParId_fkey";

-- DropForeignKey
ALTER TABLE "Bulletin" DROP CONSTRAINT "Bulletin_semestreId_fkey";

-- DropForeignKey
ALTER TABLE "Competence" DROP CONSTRAINT "Competence_sousDomaineId_fkey";

-- DropForeignKey
ALTER TABLE "Domaine" DROP CONSTRAINT "Domaine_semestreId_fkey";

-- DropForeignKey
ALTER TABLE "EnseignantMatiere" DROP CONSTRAINT "EnseignantMatiere_enseignantId_fkey";

-- DropForeignKey
ALTER TABLE "EnseignantMatiere" DROP CONSTRAINT "EnseignantMatiere_salleId_fkey";

-- DropForeignKey
ALTER TABLE "ExamenBlanc" DROP CONSTRAINT "ExamenBlanc_anneeScolaireId_fkey";

-- DropForeignKey
ALTER TABLE "ExamenBlanc" DROP CONSTRAINT "ExamenBlanc_niveauId_fkey";

-- DropForeignKey
ALTER TABLE "Frais" DROP CONSTRAINT "Frais_anneeScolaireId_fkey";

-- DropForeignKey
ALTER TABLE "JourMenu" DROP CONSTRAINT "JourMenu_periodeId_fkey";

-- DropForeignKey
ALTER TABLE "NoteExamen" DROP CONSTRAINT "NoteExamen_examenBlancId_fkey";

-- DropForeignKey
ALTER TABLE "NoteExamen" DROP CONSTRAINT "NoteExamen_matiereId_fkey";

-- DropForeignKey
ALTER TABLE "Programme" DROP CONSTRAINT "Programme_salleId_fkey";

-- DropForeignKey
ALTER TABLE "Programme" DROP CONSTRAINT "Programme_semestreId_fkey";

-- DropForeignKey
ALTER TABLE "RemarqueParent" DROP CONSTRAINT "RemarqueParent_parentId_fkey";

-- DropForeignKey
ALTER TABLE "RemiseFraternite" DROP CONSTRAINT "RemiseFraternite_anneeScolaireId_fkey";

-- DropForeignKey
ALTER TABLE "RendezVous" DROP CONSTRAINT "RendezVous_parentId_fkey";

-- DropForeignKey
ALTER TABLE "RendezVous" DROP CONSTRAINT "RendezVous_personnelId_fkey";

-- AlterTable
ALTER TABLE "Absence" DROP COLUMN "inscriptionId",
DROP COLUMN "saisiParId",
ADD COLUMN     "eleveId" INTEGER NOT NULL,
ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "AnneeScolaire" ADD COLUMN     "dateDebut" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dateFin" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Bulletin" DROP COLUMN "semestreId",
ADD COLUMN     "periode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CertificatTravail" DROP COLUMN "dateEmission",
ADD COLUMN     "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Classe" ADD COLUMN     "cycle" TEXT NOT NULL,
ADD COLUMN     "modeEvaluation" "ModeEvaluation" NOT NULL;

-- AlterTable
ALTER TABLE "Competence" ADD COLUMN     "domaineId" INTEGER,
ALTER COLUMN "sousDomaineId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Domaine" DROP COLUMN "semestreId",
ADD COLUMN     "ceintureId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "DossierPartage" DROP COLUMN "dateDepot",
DROP COLUMN "fichierUrl",
DROP COLUMN "type",
ADD COLUMN     "cheminFichier" TEXT NOT NULL,
ADD COLUMN     "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Eleve" ADD COLUMN     "matricule" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "EmploiDuTemps" DROP COLUMN "date",
ADD COLUMN     "anneeScolaireId" INTEGER NOT NULL,
DROP COLUMN "jourSemaine",
ADD COLUMN     "jourSemaine" INTEGER NOT NULL,
ALTER COLUMN "heureDebut" SET NOT NULL,
ALTER COLUMN "heureFin" SET NOT NULL;

-- AlterTable
ALTER TABLE "EnseignantMatiere" DROP COLUMN "enseignantId",
DROP COLUMN "salleId",
ADD COLUMN     "personnelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ExamenBlanc" DROP COLUMN "anneeScolaireId",
DROP COLUMN "niveauId",
DROP COLUMN "nom",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "libelle" TEXT NOT NULL,
ADD COLUMN     "matiereId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "FicheDePaie" DROP COLUMN "dateEmission",
DROP COLUMN "deductions",
ADD COLUMN     "annee" INTEGER NOT NULL,
ADD COLUMN     "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "mois",
ADD COLUMN     "mois" INTEGER NOT NULL,
ALTER COLUMN "salaireBrut" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "salaireNet" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Frais" DROP COLUMN "anneeScolaireId",
ADD COLUMN     "dateMaj" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "montant" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "rangFratrie" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Inventaire" DROP COLUMN "dateAjout",
DROP COLUMN "etat",
DROP COLUMN "nom",
ADD COLUMN     "dateMaj" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "libelle" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "JourMenu" DROP COLUMN "date",
DROP COLUMN "dessert",
DROP COLUMN "entree",
DROP COLUMN "periodeId",
DROP COLUMN "platPrincipal",
ADD COLUMN     "contenu" TEXT NOT NULL,
ADD COLUMN     "periodeMenuId" INTEGER NOT NULL,
DROP COLUMN "jourSemaine",
ADD COLUMN     "jourSemaine" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "JournalActivite" DROP COLUMN "date",
ADD COLUMN     "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "details" TEXT;

-- AlterTable
ALTER TABLE "NoteExamen" DROP COLUMN "examenBlancId",
DROP COLUMN "matiereId",
ADD COLUMN     "examenId" INTEGER NOT NULL,
ALTER COLUMN "note" SET DATA TYPE DECIMAL(4,2);

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "date",
ADD COLUMN     "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Paiement" DROP COLUMN "datePaiement",
DROP COLUMN "montantPaye",
ADD COLUMN     "anneeScolaireId" INTEGER NOT NULL,
ADD COLUMN     "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateEffective" TIMESTAMP(3),
ADD COLUMN     "datePrevue" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "montant" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'en_attente',
ALTER COLUMN "mode" DROP DEFAULT,
DROP COLUMN "moisConcerne",
ADD COLUMN     "moisConcerne" INTEGER,
ALTER COLUMN "tauxPenalite" SET DATA TYPE DECIMAL(4,2);

-- AlterTable
ALTER TABLE "ParentEleve" ADD COLUMN     "lienParente" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PeriodeMenu" DROP COLUMN "dateDebut",
DROP COLUMN "dateFin",
DROP COLUMN "nom",
ADD COLUMN     "libelle" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Personnel" DROP COLUMN "fonction",
ADD COLUMN     "matricule" TEXT NOT NULL,
ADD COLUMN     "poste" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Pointage" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Publication" DROP COLUMN "type",
DROP COLUMN "visiblePublic";

-- AlterTable
ALTER TABLE "RemarqueParent" DROP COLUMN "date",
DROP COLUMN "parentId",
DROP COLUMN "traitee",
ADD COLUMN     "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "parentEleveId" INTEGER NOT NULL,
ADD COLUMN     "utilisateurId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RemiseFraternite" DROP COLUMN "anneeScolaireId",
DROP COLUMN "montantEcolage",
DROP COLUMN "rangEnfant",
ADD COLUMN     "montant" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "rang" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RendezVous" DROP COLUMN "dateSouhaitee",
DROP COLUMN "parentId",
DROP COLUMN "personnelId",
ADD COLUMN     "dateHeure" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "parentEleveId" INTEGER NOT NULL,
ADD COLUMN     "utilisateurId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Salle" ADD COLUMN     "anneeScolaireId" INTEGER;

-- AlterTable
ALTER TABLE "Semestre" DROP COLUMN "nom",
DROP COLUMN "ordre",
ADD COLUMN     "numero" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TypeFrais" DROP COLUMN "nom",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "libelle" TEXT NOT NULL;

-- DropTable
DROP TABLE "Programme";

-- CreateTable
CREATE TABLE "Ceinture" (
    "id" SERIAL NOT NULL,
    "semestreId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ceinture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionDomaine" (
    "id" SERIAL NOT NULL,
    "domaineId" INTEGER NOT NULL,
    "salleId" INTEGER NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "dateMaj" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionDomaine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubrique" (
    "id" SERIAL NOT NULL,
    "matiereId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Rubrique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecon" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "matiereId" INTEGER NOT NULL,
    "rubriqueId" INTEGER,
    "niveauId" INTEGER NOT NULL,
    "ceintureId" INTEGER NOT NULL,

    CONSTRAINT "Lecon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionLecon" (
    "id" SERIAL NOT NULL,
    "leconId" INTEGER NOT NULL,
    "salleId" INTEGER NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "dateRealisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionLecon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ceinture_semestreId_nom_key" ON "Ceinture"("semestreId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionDomaine_domaineId_salleId_key" ON "ProgressionDomaine"("domaineId", "salleId");

-- CreateIndex
CREATE UNIQUE INDEX "Rubrique_matiereId_nom_key" ON "Rubrique"("matiereId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionLecon_leconId_salleId_key" ON "ProgressionLecon"("leconId", "salleId");

-- CreateIndex
CREATE UNIQUE INDEX "AnneeScolaire_libelle_key" ON "AnneeScolaire"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_nom_key" ON "Classe"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_ordre_key" ON "Classe"("ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_matricule_key" ON "Eleve"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "EnseignantMatiere_personnelId_matiereId_key" ON "EnseignantMatiere"("personnelId", "matiereId");

-- CreateIndex
CREATE UNIQUE INDEX "Matiere_nom_key" ON "Matiere"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "MatiereCoefficient_matiereId_niveauId_key" ON "MatiereCoefficient"("matiereId", "niveauId");

-- CreateIndex
CREATE UNIQUE INDEX "Niveau_classeId_nom_key" ON "Niveau"("classeId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "NoteCompetence_inscriptionId_competenceId_key" ON "NoteCompetence"("inscriptionId", "competenceId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteExamen_examenId_inscriptionId_key" ON "NoteExamen"("examenId", "inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_matricule_key" ON "Personnel"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "RemiseFraternite_rang_key" ON "RemiseFraternite"("rang");

-- CreateIndex
CREATE UNIQUE INDEX "Salle_nom_key" ON "Salle"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Semestre_niveauId_numero_key" ON "Semestre"("niveauId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "TypeFrais_code_key" ON "TypeFrais"("code");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salle" ADD CONSTRAINT "Salle_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ceinture" ADD CONSTRAINT "Ceinture_semestreId_fkey" FOREIGN KEY ("semestreId") REFERENCES "Semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domaine" ADD CONSTRAINT "Domaine_ceintureId_fkey" FOREIGN KEY ("ceintureId") REFERENCES "Ceinture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competence" ADD CONSTRAINT "Competence_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competence" ADD CONSTRAINT "Competence_sousDomaineId_fkey" FOREIGN KEY ("sousDomaineId") REFERENCES "SousDomaine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionDomaine" ADD CONSTRAINT "ProgressionDomaine_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionDomaine" ADD CONSTRAINT "ProgressionDomaine_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionDomaine" ADD CONSTRAINT "ProgressionDomaine_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubrique" ADD CONSTRAINT "Rubrique_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecon" ADD CONSTRAINT "Lecon_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecon" ADD CONSTRAINT "Lecon_rubriqueId_fkey" FOREIGN KEY ("rubriqueId") REFERENCES "Rubrique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecon" ADD CONSTRAINT "Lecon_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "Niveau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecon" ADD CONSTRAINT "Lecon_ceintureId_fkey" FOREIGN KEY ("ceintureId") REFERENCES "Ceinture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionLecon" ADD CONSTRAINT "ProgressionLecon_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "Lecon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionLecon" ADD CONSTRAINT "ProgressionLecon_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionLecon" ADD CONSTRAINT "ProgressionLecon_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantMatiere" ADD CONSTRAINT "EnseignantMatiere_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlanc" ADD CONSTRAINT "ExamenBlanc_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExamen" ADD CONSTRAINT "NoteExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "ExamenBlanc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourMenu" ADD CONSTRAINT "JourMenu_periodeMenuId_fkey" FOREIGN KEY ("periodeMenuId") REFERENCES "PeriodeMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_parentEleveId_fkey" FOREIGN KEY ("parentEleveId") REFERENCES "ParentEleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemarqueParent" ADD CONSTRAINT "RemarqueParent_parentEleveId_fkey" FOREIGN KEY ("parentEleveId") REFERENCES "ParentEleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemarqueParent" ADD CONSTRAINT "RemarqueParent_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
