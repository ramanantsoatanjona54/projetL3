-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "derniereConnexion" TIMESTAMP(3),
ADD COLUMN     "doitChangerMotDePasse" BOOLEAN NOT NULL DEFAULT false;
