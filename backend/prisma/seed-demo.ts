import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Alea, MOT_DE_PASSE_DEMO, chargerEnv, verifierSecurite } from './demo/contexte';
import { nettoyer } from './demo/nettoyage';
import { creerFamilles, creerPersonnel, preparerContexte } from './demo/personnes';
import { creerPaiements } from './demo/finances';
import { creerAbsences, creerPaie, creerPointages } from './demo/suivi';
import { creerPedagogie } from './demo/pedagogie';

chargerEnv();

async function main(): Promise<void> {
  verifierSecurite();
  const prisma = new PrismaClient();
  try {
    const alea = new Alea(2026);
    const hash = await bcrypt.hash(MOT_DE_PASSE_DEMO, 10);

    console.log('1/3  Préparation…');
    const ctx = await preparerContexte(prisma, alea, hash);
    console.log(`     Année ${ctx.annee.libelle} · ${ctx.salles.length} salle(s)`);

    console.log('2/3  Nettoyage des anciennes données…');
    await nettoyer(prisma);

    console.log('3/3  Création du jeu d\'essai…');
    await creerPersonnel(ctx);
    await creerFamilles(ctx);
    // --- la partie 2 ajoutera ici : paiements, absences, pointage, pédagogie, vie scolaire… ---
        console.log('     Paiements, absences, pointages, paie…');
    await creerPaiements(ctx);
    await creerAbsences(ctx);
    await creerPointages(ctx);
    await creerPaie(ctx);
    console.log('     Pédagogie…');
    await creerPedagogie(ctx);
    // --- la partie 3 ajoutera ici : emploi du temps, menu, inventaire, annonces, rendez-vous, remarques ---
    const lignes = ctx.comptes.map((c) => `${c.role.padEnd(12)} ${c.email.padEnd(60)} ${c.libelle}`);
    writeFileSync(
      join(__dirname, 'comptes-demo.txt'),
      `Mot de passe de tous les comptes fictifs : ${MOT_DE_PASSE_DEMO}\n` +
        `(admin et directrice : vos comptes habituels, inchangés)\n\n${lignes.join('\n')}\n`,
    );

    const attente = ctx.eleves.filter((e) => e.statut === 'en_attente').length;
    console.log('\n✔ Terminé.');
    console.log(`   ${ctx.agents.length} agents · ${ctx.familles.length} familles · ${ctx.eleves.length} élèves (dont ${attente} inscription(s) en attente)`);
    console.log('   Comptes et mot de passe : prisma/comptes-demo.txt');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});