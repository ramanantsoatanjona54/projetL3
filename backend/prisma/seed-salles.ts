/**
 * backend/prisma/seed-salles.ts
 *
 * Cree les salles reelles de l'ecole et les relie a TOUS les niveaux
 * de leur classe (une salle = classe multi-niveaux : ex. "1A" regroupe
 * PS + MS + GS avec un seul enseignant).
 *
 * Classe 1 -> salles A, B, C   (chacune : PS, MS, GS)
 * Classe 2 -> salles A, B, C   (chacune : 11e, 10e)
 * Classe 3 -> salles A, B, C, D (chacune : 9e, 8e, 7e)
 *
 * Idempotent : relançable sans doublons.
 *
 * Usage : npx ts-node prisma/seed-salles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STRUCTURE: Record<string, string[]> = {
  'Classe 1': ['A', 'B', 'C'],
  'Classe 2': ['A', 'B', 'C'],
  'Classe 3': ['A', 'B', 'C', 'D'],
};

async function main() {
  for (const [nomClasse, lettres] of Object.entries(STRUCTURE)) {
    const classe = await prisma.classe.findUnique({ where: { nom: nomClasse } });
    if (!classe) {
      throw new Error(`${nomClasse} introuvable — lance d'abord seed.ts`);
    }

    const niveaux = await prisma.niveau.findMany({ where: { classeId: classe.id } });
    if (niveaux.length === 0) {
      throw new Error(`Aucun niveau trouve pour ${nomClasse} — lance d'abord seed.ts`);
    }

    for (const lettre of lettres) {
      // ex: "1A", "2B", "3D" -> ordre de la classe + lettre
      const nomSalle = `${classe.ordre}${lettre}`;

      const salle = await prisma.salle.upsert({
        where: { nom: nomSalle },
        update: {},
        create: { nom: nomSalle },
      });

      // relie la salle a TOUS les niveaux de sa classe (many-to-many)
      await prisma.salle.update({
        where: { id: salle.id },
        data: {
          niveaux: {
            connect: niveaux.map((n) => ({ id: n.id })),
          },
        },
      });

      console.log(`Salle ${nomSalle} <-> [${niveaux.map((n) => n.nom).join(', ')}]`);
    }
  }

  console.log('Salles creees/verifiees.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
