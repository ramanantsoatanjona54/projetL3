/*
  Warnings:

  - You are about to drop the column `eleveId` on the `Absence` table. All the data in the column will be lost.
  - You are about to drop the column `cheminFichier` on the `DossierPartage` table. All the data in the column will be lost.
  - You are about to drop the column `dateAjout` on the `DossierPartage` table. All the data in the column will be lost.
  - You are about to drop the column `contenu` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `jourSemaine` on the `JourMenu` table. All the data in the column will be lost.
  - You are about to drop the column `libelle` on the `PeriodeMenu` table. All the data in the column will be lost.
  - Added the required column `inscriptionId` to the `Absence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `saisiParId` to the `Absence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fichierUrl` to the `DossierPartage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `JourMenu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateDebut` to the `PeriodeMenu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateFin` to the `PeriodeMenu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nom` to the `PeriodeMenu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Publication` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Absence" DROP CONSTRAINT "Absence_eleveId_fkey";

-- AlterTable
ALTER TABLE "Absence" DROP COLUMN "eleveId",
ADD COLUMN     "inscriptionId" INTEGER NOT NULL,
ADD COLUMN     "saisiParId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "DossierPartage" DROP COLUMN "cheminFichier",
DROP COLUMN "dateAjout",
ADD COLUMN     "dateDepot" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fichierUrl" TEXT NOT NULL,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "JourMenu" DROP COLUMN "contenu",
DROP COLUMN "jourSemaine",
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "dessert" TEXT,
ADD COLUMN     "entree" TEXT,
ADD COLUMN     "platPrincipal" TEXT;

-- AlterTable
ALTER TABLE "PeriodeMenu" DROP COLUMN "libelle",
ADD COLUMN     "dateDebut" DATE NOT NULL,
ADD COLUMN     "dateFin" DATE NOT NULL,
ADD COLUMN     "nom" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "visiblePublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RemarqueParent" ADD COLUMN     "traitee" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
