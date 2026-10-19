/*
  Warnings:

  - A unique constraint covering the columns `[numeroRecu]` on the table `Paiement` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "enregistreParId" INTEGER,
ADD COLUMN     "montantPenalite" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "motifAnnulation" TEXT,
ADD COLUMN     "numeroRecu" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_numeroRecu_key" ON "Paiement"("numeroRecu");

-- CreateIndex
CREATE INDEX "Paiement_inscriptionId_idx" ON "Paiement"("inscriptionId");
-- Garantit l'index des inscriptions (sans effet s'il existe deja)
CREATE UNIQUE INDEX IF NOT EXISTS "Inscription_eleve_annee_active_key"
  ON "Inscription" ("eleveId", "anneeScolaireId")
  WHERE "statut" <> 'annulee';

-- Un mois ne peut etre encaisse qu'une fois (sauf si le paiement a ete annule)
CREATE UNIQUE INDEX "Paiement_mensuel_actif_key"
  ON "Paiement" ("inscriptionId", "typeFraisId", "moisConcerne")
  WHERE "mode" = 'MENSUEL' AND "statut" <> 'annule';

-- Un seul paiement annuel par inscription
CREATE UNIQUE INDEX "Paiement_annuel_actif_key"
  ON "Paiement" ("inscriptionId", "typeFraisId")
  WHERE "mode" = 'GLOBAL_ANNUEL' AND "statut" <> 'annule';