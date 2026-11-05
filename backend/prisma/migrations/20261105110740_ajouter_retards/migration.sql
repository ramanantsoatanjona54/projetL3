-- CreateTable
CREATE TABLE "Retard" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "saisiParId" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Retard_date_idx" ON "Retard"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Retard_inscriptionId_date_key" ON "Retard"("inscriptionId", "date");

-- AddForeignKey
ALTER TABLE "Retard" ADD CONSTRAINT "Retard_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retard" ADD CONSTRAINT "Retard_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
