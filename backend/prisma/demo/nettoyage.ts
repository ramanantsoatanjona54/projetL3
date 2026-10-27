import { PrismaClient } from '@prisma/client';

// Efface tout, sauf : programmes, classes, niveaux, salles, ceintures, année scolaire, tarifs,
// et les comptes ADMIN et DIRECTRICE (avec leur fiche personnel).
export async function nettoyer(prisma: PrismaClient): Promise<void> {
  const gardes = await prisma.utilisateur.findMany({
    where: { role: { in: ['ADMIN', 'DIRECTRICE'] } },
    select: { id: true, personnelId: true },
  });
  const idsGardes = gardes.map((u) => u.id);
  const personnelGardes = gardes.map((u) => u.personnelId).filter((x): x is number => x !== null);

  await prisma.$transaction(
    async (tx) => {
      // enfants d'abord, parents ensuite (clés étrangères)
      await tx.notification.deleteMany();
      await tx.journalActivite.deleteMany();
      await tx.rendezVous.deleteMany();
      await tx.remarqueParent.deleteMany();
      await tx.absence.deleteMany();
      await tx.mouvementInventaire.deleteMany();
      await tx.inventaire.deleteMany();
      await tx.noteExamen.deleteMany();
      await tx.examenBlancDiscipline.deleteMany();
      await tx.examenBlanc.deleteMany();
      await tx.noteCompetence.deleteMany();
      await tx.noteLecon.deleteMany();
      await tx.progressionDomaine.deleteMany();
      await tx.progressionLecon.deleteMany();
      await tx.bulletin.deleteMany();
      await tx.emploiDuTemps.deleteMany();
      await tx.enseignantMatiere.deleteMany();
      await tx.ficheDePaie.deleteMany();
      await tx.certificatTravail.deleteMany();
      await tx.pointage.deleteMany();
      await tx.paiement.deleteMany();
      await tx.inscription.deleteMany();
      await tx.parentEleve.deleteMany();
      await tx.dossierPartage.updateMany({
        where: { deposeParId: { notIn: idsGardes } },
        data: { deposeParId: null },
      });
      await tx.publication.deleteMany();
      await tx.jourMenu.deleteMany();
      await tx.periodeMenu.deleteMany();
      await tx.utilisateur.deleteMany({ where: { id: { notIn: idsGardes } } }); // sessions et codes de secours en cascade
      await tx.eleve.deleteMany();
      await tx.parent.deleteMany();
      await tx.personnel.deleteMany({ where: { id: { notIn: personnelGardes } } });
    },
    { timeout: 300_000, maxWait: 20_000 },
  );

  // Le journal d'audit est en « ajout seulement » pour le compte applicatif : il faut le compte propriétaire.
  try {
    const r = await prisma.journalAudit.deleteMany();
    console.log(`  Journal d'audit vidé (${r.count} ligne(s)).`);
  } catch {
    console.warn("  ⚠ Journal d'audit non vidé (droits insuffisants). Renseignez DATABASE_URL_MIGRATION pour le vider.");
  }
}