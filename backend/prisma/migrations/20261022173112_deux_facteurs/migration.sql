-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "totpActif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpDernierPas" INTEGER,
ADD COLUMN     "totpSecretChiffre" TEXT;

-- CreateTable
CREATE TABLE "CodeSecours" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "utilise" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CodeSecours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeSecours_utilisateurId_utilise_idx" ON "CodeSecours"("utilisateurId", "utilise");

-- AddForeignKey
ALTER TABLE "CodeSecours" ADD CONSTRAINT "CodeSecours_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
