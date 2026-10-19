/*
  Warnings:

  - Added the required column `dateEmbauche` to the `Personnel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fonction` to the `Personnel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nom` to the `Personnel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prenom` to the `Personnel` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TypeCertificat" AS ENUM ('CERTIFICAT_TRAVAIL', 'CONTRAT');

-- CreateEnum
CREATE TYPE "TypeInventaire" AS ENUM ('SCOLAIRE', 'INFORMATIQUE');

-- CreateEnum
CREATE TYPE "StatutRendezVous" AS ENUM ('DEMANDE', 'CONFIRME', 'ANNULE');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('ADMIN', 'ENSEIGNANT', 'SECRETARIAT', 'COMPTABLE', 'DIRECTRICE', 'PARENT');

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "dateEmbauche" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fonction" TEXT NOT NULL,
ADD COLUMN     "nom" TEXT NOT NULL,
ADD COLUMN     "prenom" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "FicheDePaie" (
    "id" SERIAL NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "mois" TEXT NOT NULL,
    "salaireBrut" DECIMAL(65,30) NOT NULL,
    "deductions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "salaireNet" DECIMAL(65,30) NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FicheDePaie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificatTravail" (
    "id" SERIAL NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "type" "TypeCertificat" NOT NULL,
    "contenu" TEXT NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificatTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" SERIAL NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heureArrivee" TIMESTAMP(3),
    "heureDepart" TIMESTAMP(3),

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploiDuTemps" (
    "id" SERIAL NOT NULL,
    "salleId" INTEGER NOT NULL,
    "niveauId" INTEGER NOT NULL,
    "matiereId" INTEGER,
    "enseignantId" INTEGER,
    "jourSemaine" TEXT,
    "heureDebut" TEXT,
    "heureFin" TEXT,
    "date" TIMESTAMP(3),
    "titre" TEXT,

    CONSTRAINT "EmploiDuTemps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "justifiee" BOOLEAN NOT NULL DEFAULT false,
    "motif" TEXT,
    "saisiParId" INTEGER NOT NULL,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierPartage" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "fichierUrl" TEXT NOT NULL,
    "type" TEXT,
    "dateDepot" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierPartage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodeMenu" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodeMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourMenu" (
    "id" SERIAL NOT NULL,
    "periodeId" INTEGER NOT NULL,
    "jourSemaine" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "entree" TEXT,
    "platPrincipal" TEXT,
    "dessert" TEXT,

    CONSTRAINT "JourMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventaire" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeInventaire" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "etat" TEXT,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalActivite" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalActivite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "datePublication" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visiblePublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "dateSouhaitee" TIMESTAMP(3) NOT NULL,
    "statut" "StatutRendezVous" NOT NULL DEFAULT 'DEMANDE',
    "motif" TEXT,

    CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemarqueParent" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "contenu" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traitee" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RemarqueParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "personnelId" INTEGER,
    "parentEleveId" INTEGER,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_personnelId_key" ON "Utilisateur"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_parentEleveId_key" ON "Utilisateur"("parentEleveId");

-- AddForeignKey
ALTER TABLE "FicheDePaie" ADD CONSTRAINT "FicheDePaie_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificatTravail" ADD CONSTRAINT "CertificatTravail_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "Niveau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourMenu" ADD CONSTRAINT "JourMenu_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "PeriodeMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalActivite" ADD CONSTRAINT "JournalActivite_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemarqueParent" ADD CONSTRAINT "RemarqueParent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_parentEleveId_fkey" FOREIGN KEY ("parentEleveId") REFERENCES "ParentEleve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
