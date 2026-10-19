-- CreateEnum
CREATE TYPE "NiveauCompetence" AS ENUM ('A', 'EA', 'AR');

-- CreateTable
CREATE TABLE "Personnel" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semestre" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "niveauId" INTEGER NOT NULL,

    CONSTRAINT "Semestre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domaine" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "semestreId" INTEGER NOT NULL,

    CONSTRAINT "Domaine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SousDomaine" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "domaineId" INTEGER NOT NULL,

    CONSTRAINT "SousDomaine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competence" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "sousDomaineId" INTEGER NOT NULL,

    CONSTRAINT "Competence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteCompetence" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "competenceId" INTEGER NOT NULL,
    "niveau" "NiveauCompetence" NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "dateSaisie" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matiere" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Matiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatiereCoefficient" (
    "id" SERIAL NOT NULL,
    "matiereId" INTEGER NOT NULL,
    "niveauId" INTEGER NOT NULL,
    "coefficient" INTEGER NOT NULL,

    CONSTRAINT "MatiereCoefficient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnseignantMatiere" (
    "id" SERIAL NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "matiereId" INTEGER NOT NULL,
    "salleId" INTEGER NOT NULL,

    CONSTRAINT "EnseignantMatiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" SERIAL NOT NULL,
    "salleId" INTEGER NOT NULL,
    "semestreId" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamenBlanc" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "anneeScolaireId" INTEGER NOT NULL,
    "niveauId" INTEGER NOT NULL,

    CONSTRAINT "ExamenBlanc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteExamen" (
    "id" SERIAL NOT NULL,
    "examenBlancId" INTEGER NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "matiereId" INTEGER NOT NULL,
    "note" DECIMAL(65,30) NOT NULL,
    "enseignantId" INTEGER NOT NULL,
    "dateSaisie" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bulletin" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "semestreId" INTEGER NOT NULL,
    "appreciationGenerale" TEXT,
    "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Semestre" ADD CONSTRAINT "Semestre_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "Niveau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domaine" ADD CONSTRAINT "Domaine_semestreId_fkey" FOREIGN KEY ("semestreId") REFERENCES "Semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SousDomaine" ADD CONSTRAINT "SousDomaine_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competence" ADD CONSTRAINT "Competence_sousDomaineId_fkey" FOREIGN KEY ("sousDomaineId") REFERENCES "SousDomaine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCompetence" ADD CONSTRAINT "NoteCompetence_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCompetence" ADD CONSTRAINT "NoteCompetence_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "Competence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCompetence" ADD CONSTRAINT "NoteCompetence_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatiereCoefficient" ADD CONSTRAINT "MatiereCoefficient_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatiereCoefficient" ADD CONSTRAINT "MatiereCoefficient_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "Niveau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantMatiere" ADD CONSTRAINT "EnseignantMatiere_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantMatiere" ADD CONSTRAINT "EnseignantMatiere_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantMatiere" ADD CONSTRAINT "EnseignantMatiere_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_semestreId_fkey" FOREIGN KEY ("semestreId") REFERENCES "Semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlanc" ADD CONSTRAINT "ExamenBlanc_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamenBlanc" ADD CONSTRAINT "ExamenBlanc_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "Niveau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExamen" ADD CONSTRAINT "NoteExamen_examenBlancId_fkey" FOREIGN KEY ("examenBlancId") REFERENCES "ExamenBlanc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExamen" ADD CONSTRAINT "NoteExamen_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExamen" ADD CONSTRAINT "NoteExamen_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExamen" ADD CONSTRAINT "NoteExamen_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_semestreId_fkey" FOREIGN KEY ("semestreId") REFERENCES "Semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
