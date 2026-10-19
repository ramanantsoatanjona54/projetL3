-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('MENSUEL', 'GLOBAL_ANNUEL');

-- CreateTable
CREATE TABLE "AnneeScolaire" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "AnneeScolaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeFrais" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "TypeFrais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Frais" (
    "id" SERIAL NOT NULL,
    "typeFraisId" INTEGER NOT NULL,
    "anneeScolaireId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemiseFraternite" (
    "id" SERIAL NOT NULL,
    "anneeScolaireId" INTEGER NOT NULL,
    "rangEnfant" INTEGER NOT NULL,
    "montantEcolage" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "RemiseFraternite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "typeFraisId" INTEGER NOT NULL,
    "mode" "ModePaiement" NOT NULL DEFAULT 'MENSUEL',
    "moisConcerne" TEXT,
    "montantPaye" DECIMAL(65,30) NOT NULL,
    "datePaiement" TIMESTAMP(3),
    "tauxPenalite" DECIMAL(65,30) NOT NULL DEFAULT 0.10,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_typeFraisId_fkey" FOREIGN KEY ("typeFraisId") REFERENCES "TypeFrais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemiseFraternite" ADD CONSTRAINT "RemiseFraternite_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_typeFraisId_fkey" FOREIGN KEY ("typeFraisId") REFERENCES "TypeFrais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
