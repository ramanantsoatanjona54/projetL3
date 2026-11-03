import { PrismaClient } from '@prisma/client';

// Efface TOUTES les notes d'examens blancs (données de test). Les examens et leurs disciplines restent.
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const r = await prisma.noteExamen.deleteMany();
    console.log(`${r.count} note(s) d'examen blanc effacée(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });