import { PrismaClient, RoleUtilisateur } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ---------------------------------------------------------------
  // Annee scolaire
  // ---------------------------------------------------------------
  const anneeScolaire = await prisma.anneeScolaire.upsert({
    where: { libelle: '2025-2026' },
    update: {},
    create: {
      libelle: '2025-2026',
      dateDebut: new Date('2025-09-01'),
      dateFin: new Date('2026-06-30'),
    },
  });

  // ---------------------------------------------------------------
  // Types de frais + bareme
  // ---------------------------------------------------------------
  const typeInscription = await prisma.typeFrais.upsert({
    where: { code: 'INSCRIPTION' },
    update: {},
    create: { code: 'INSCRIPTION', libelle: 'Frais d\'inscription' },
  });

  const typeEcolage = await prisma.typeFrais.upsert({
    where: { code: 'ECOLAGE' },
    update: {},
    create: { code: 'ECOLAGE', libelle: 'Écolage mensuel' },
  });

  const fraisInscriptionExist = await prisma.frais.findFirst({ where: { typeFraisId: typeInscription.id } });
  if (!fraisInscriptionExist) {
    await prisma.frais.create({ data: { typeFraisId: typeInscription.id, montant: 650000 } });
  }

  const fraisEcolageExist = await prisma.frais.findFirst({ where: { typeFraisId: typeEcolage.id } });
  if (!fraisEcolageExist) {
    await prisma.frais.create({ data: { typeFraisId: typeEcolage.id, montant: 325000 } });
  }

  // ---------------------------------------------------------------
  // Remises fraternite (uniforme, pas liee a une annee scolaire precise)
  // ---------------------------------------------------------------
  await prisma.remiseFraternite.upsert({
    where: { rang: 2 },
    update: {},
    create: { rang: 2, montant: 315000 },
  });
  await prisma.remiseFraternite.upsert({
    where: { rang: 3 },
    update: {},
    create: { rang: 3, montant: 300000 },
  });
  await prisma.remiseFraternite.upsert({
    where: { rang: 4 },
    update: {},
    create: { rang: 4, montant: 290000 },
  });

  // ---------------------------------------------------------------
  // Classes + niveaux
  // ---------------------------------------------------------------
const classe1 = await prisma.classe.upsert({
  where: { nom: 'Classe 1' },
  update: {},
  create: {
    nom: 'Classe 1',
    ordre: 1,
    cycle: 'prescolaire',
  },
});
const classe2 = await prisma.classe.upsert({
  where: { nom: 'Classe 2' },
  update: {},
  create: {
    nom: 'Classe 2',
    ordre: 2,
    cycle: 'primaire_1',
  },
});
const classe3 = await prisma.classe.upsert({
  where: { nom: 'Classe 3' },
  update: {},
  create: {
    nom: 'Classe 3',
    ordre: 3,
    cycle: 'primaire_2',
  },
});

  const niveaux: Array<{ classeId: number; nom: string; ordre: number }> = [
    { classeId: classe1.id, nom: 'PS', ordre: 1 },
    { classeId: classe1.id, nom: 'MS', ordre: 2 },
    { classeId: classe1.id, nom: 'GS', ordre: 3 },
    { classeId: classe2.id, nom: '11e', ordre: 1 },
    { classeId: classe2.id, nom: '10e', ordre: 2 },
    { classeId: classe3.id, nom: '9e', ordre: 1 },
    { classeId: classe3.id, nom: '8e', ordre: 2 },
    { classeId: classe3.id, nom: '7e', ordre: 3 },
  ];

  for (const n of niveaux) {
    await prisma.niveau.upsert({
      where: { classeId_nom: { classeId: n.classeId, nom: n.nom } },
      update: {},
      create: n,
    });
  }

  // ---------------------------------------------------------------
  // Compte admin
  // ---------------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@colibris.mg';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMoi123';
  const motDePasseHash = await bcrypt.hash(adminPassword, 12);

  await prisma.utilisateur.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      motDePasseHash,
      role: RoleUtilisateur.ADMIN,
    },
  });

  console.log('Seed termine.');
  console.log(`Annee scolaire : ${anneeScolaire.libelle}`);
  console.log(`Admin : ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });