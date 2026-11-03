import { PrismaClient } from '@prisma/client';

// Disciplines de l'examen blanc de la 7e (modèle de l'école). Idempotent : une matière déjà présente
// (même écrite autrement : majuscules, accents) n'est jamais recréée, donc pas de doublon.
const DISCIPLINES = ['Opérations', 'Problèmes', 'Géographie', 'Sciences de la vie et de la terre', 'Histoire'];

const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const existantes = await prisma.matiere.findMany({ select: { nom: true } });
    const connues = new Set(existantes.map((m) => normaliser(m.nom)));
    for (const nom of DISCIPLINES) {
      if (connues.has(normaliser(nom))) { console.log(`= déjà présente : ${nom}`); continue; }
      await prisma.matiere.create({ data: { nom } });
      console.log(`+ ajoutée : ${nom}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });