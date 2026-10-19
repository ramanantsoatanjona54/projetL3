-- CreateEnum
CREATE TYPE "TypeMouvementInventaire" AS ENUM ('ENTREE', 'SORTIE');

-- CreateTable
CREATE TABLE "MouvementInventaire" (
    "id" SERIAL NOT NULL,
    "inventaireId" INTEGER NOT NULL,
    "type" "TypeMouvementInventaire" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "motif" TEXT,
    "dateMouvement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementInventaire_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MouvementInventaire" ADD CONSTRAINT "MouvementInventaire_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "Inventaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementInventaire" ADD CONSTRAINT "MouvementInventaire_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
