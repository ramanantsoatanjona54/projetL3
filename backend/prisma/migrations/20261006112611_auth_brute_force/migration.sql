-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "tentativesEchouees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verrouilleJusqua" TIMESTAMP(3);
