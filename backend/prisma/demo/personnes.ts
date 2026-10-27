import { PrismaClient } from '@prisma/client';
import {
  Alea, Ctx, EleveCtx, FamilleCtx, NiveauCtx, SalleCtx, AgentCtx,
  BANQUES, NOMS, POSTES, PRENOMS_F, PRENOMS_M, PROFESSIONS, QUARTIERS,
  ajouterJours, emailUnique, enJour, jourLocalIso, pad, telephone,
} from './contexte';

// ---------- Préparation : année, salles, comptes conservés ----------
export async function preparerContexte(prisma: PrismaClient, alea: Alea, hash: string): Promise<Ctx> {
  const maintenant = new Date();
  const annee =
    (await prisma.anneeScolaire.findFirst({ where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } } })) ??
    (await prisma.anneeScolaire.findFirst({ orderBy: { dateDebut: 'desc' } }));
  if (!annee) throw new Error("Aucune année scolaire en base : créez-en une avant le jeu d'essai.");

  const admin = await prisma.utilisateur.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const directrice = await prisma.utilisateur.findFirst({ where: { role: 'DIRECTRICE' }, select: { id: true, personnelId: true } });
  if (!admin) throw new Error('Compte administrateur introuvable (il doit exister avant le jeu d\'essai).');
  if (!directrice) throw new Error('Compte directrice introuvable (il doit exister avant le jeu d\'essai).');

  const sallesDb = await prisma.salle.findMany({
    include: { niveaux: { include: { classe: true }, orderBy: { ordre: 'asc' } } },
    orderBy: { nom: 'asc' },
  });
  const salles: SalleCtx[] = sallesDb
    .filter((s) => s.niveaux.length > 0)
    .map((s) => ({
      id: s.id,
      nom: s.nom,
      niveaux: s.niveaux.map((n): NiveauCtx => ({ id: n.id, nom: n.nom, ordre: n.ordre, cycle: n.classe.cycle })),
    }));
  if (salles.length === 0) throw new Error('Aucune salle avec niveaux en base.');

  const gardes = await prisma.utilisateur.findMany({ select: { email: true } });
  const emailsPris = new Set(gardes.map((u) => u.email.toLowerCase()));

  return {
    prisma, alea, hash, maintenant,
    aujourdhui: jourLocalIso(maintenant),
    annee: { id: annee.id, libelle: annee.libelle, dateDebut: annee.dateDebut, dateFin: annee.dateFin },
    adminId: admin.id,
    directriceId: directrice.id,
    directricePersonnelId: directrice.personnelId,
    salles, agents: [], familles: [], eleves: [], comptes: [],
    emailsPris, cinsPris: new Set<string>(), compteurPersonnel: 0,
  };
}

// ---------- Personnel et comptes ----------
interface OptionsAgent {
  role: 'ENSEIGNANT' | 'SECRETARIAT' | 'COMPTABLE';
  poste: string;
  sexe: 'M' | 'F';
  salleId?: number;
  enseigne: boolean;
  libelle: string;
  actif?: boolean;
  mdpTemporaire?: boolean;
  verrouille?: boolean;
  dateDepart?: Date;
}

async function creerAgent(ctx: Ctx, o: OptionsAgent): Promise<AgentCtx> {
  const { prisma, alea } = ctx;
  const prenom = alea.choisir(o.sexe === 'F' ? PRENOMS_F : PRENOMS_M);
  const nom = alea.choisir(NOMS);
  ctx.compteurPersonnel += 1;
  const anneeDebut = ctx.annee.dateDebut.getUTCFullYear();

  let cin: string;
  do { cin = Array.from({ length: 12 }, () => alea.entier(0, 9)).join(''); } while (ctx.cinsPris.has(cin));
  ctx.cinsPris.add(cin);

  const age = alea.entier(24, 55);
  const naissance = new Date(Date.UTC(ctx.maintenant.getUTCFullYear() - age, alea.entier(0, 11), alea.entier(1, 28)));

  const personnel = await prisma.personnel.create({
    data: {
      matricule: `PER-${anneeDebut}-D${pad(ctx.compteurPersonnel, 3)}`,
      nom, prenom, sexe: o.sexe, dateNaissance: naissance, cin,
      adresse: `${alea.entier(1, 90)} rue de ${alea.choisir(QUARTIERS)}, Antananarivo`,
      telephone: telephone(alea),
      indemniteTransportJour: 3000,
      numeroCnaps: `CNAPS-${pad(alea.entier(0, 99999999), 8)}`,
      poste: o.poste,
      salleAffecteeId: o.salleId ?? null,
      lieuAffectation: 'Les Colibris · Mahamasina',
      autorisationEnseigner: o.enseigne,
      banque: alea.choisir(BANQUES),
      dateEmbauche: enJour(ajouterJours(ctx.aujourdhui, -alea.entier(120, 2500))),
      dateDepart: o.dateDepart ?? null,
    },
  });

  const actif = o.actif ?? true;
  const email = emailUnique(ctx, `${prenom}.${nom}`);
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email, motDePasseHash: ctx.hash, role: o.role, personnelId: personnel.id,
      actif,
      doitChangerMotDePasse: o.mdpTemporaire ?? false,
      tentativesEchouees: o.verrouille ? 5 : 0,
      verrouilleJusqua: o.verrouille ? new Date(ctx.maintenant.getTime() + 12 * 3600 * 1000) : null,
      derniereConnexion: actif ? new Date(ctx.maintenant.getTime() - alea.entier(1, 72) * 3600 * 1000) : null,
    },
  });

  const agent: AgentCtx = {
    personnelId: personnel.id, utilisateurId: utilisateur.id, nom, prenom, poste: o.poste,
    role: o.role, salleId: o.salleId, actif, dateDepart: o.dateDepart ?? null,
  };
  ctx.agents.push(agent);
  ctx.comptes.push({ role: o.role, email, libelle: `${prenom} ${nom} · ${o.libelle}` });
  return agent;
}

export async function creerPersonnel(ctx: Ctx): Promise<void> {
  const { alea } = ctx;

  // Un enseignant titulaire par salle (affectation faite)
  for (const salle of ctx.salles) {
    const a = await creerAgent(ctx, {
      role: 'ENSEIGNANT', poste: POSTES.ENSEIGNANT, sexe: alea.proba(0.8) ? 'F' : 'M',
      salleId: salle.id, enseigne: true, libelle: `titulaire de la salle ${salle.nom}`,
    });
    salle.enseignantPersonnelId = a.personnelId;
    salle.enseignantUtilisateurId = a.utilisateurId;
  }

  // Enseignant sans salle, mot de passe temporaire : pour tester l'affectation et le changement de mot de passe
  await creerAgent(ctx, {
    role: 'ENSEIGNANT', poste: POSTES.ENSEIGNANT, sexe: 'F', enseigne: true,
    mdpTemporaire: true, libelle: 'sans salle, mot de passe temporaire',
  });

  // Enseignant parti : compte désactivé, date de départ passée
  await creerAgent(ctx, {
    role: 'ENSEIGNANT', poste: POSTES.ENSEIGNANT, sexe: 'M', enseigne: true, actif: false,
    dateDepart: enJour(ajouterJours(ctx.aujourdhui, -20)), libelle: 'ancien enseignant (parti, compte désactivé)',
  });

  // Secrétariat (x2), comptable
  await creerAgent(ctx, { role: 'SECRETARIAT', poste: POSTES.SECRETARIAT, sexe: 'F', enseigne: false, libelle: 'secrétariat' });
  await creerAgent(ctx, { role: 'SECRETARIAT', poste: POSTES.SECRETARIAT, sexe: 'F', enseigne: false, libelle: 'secrétariat (2e compte)' });
  await creerAgent(ctx, { role: 'COMPTABLE', poste: POSTES.COMPTABLE, sexe: 'M', enseigne: false, libelle: 'comptable' });

  // Compte verrouillé (pour tester « Déverrouiller » dans la gestion des comptes)
  await creerAgent(ctx, {
    role: 'SECRETARIAT', poste: POSTES.ASSISTANT, sexe: 'F', enseigne: false,
    verrouille: true, libelle: 'compte VERROUILLÉ (5 échecs)',
  });
}

// ---------- Familles, élèves, inscriptions ----------
const AGES: Record<string, number> = { PS: 3, MS: 4, GS: 5, '11e': 6, '10e': 7, '9e': 8, '8e': 9, '7e': 10 };
const TAILLES_FAMILLE = [1, 2, 1, 3, 1, 1, 2, 1, 4, 1, 2, 1];
const EMAIL_LONG = 'jean-christophe.rakotoarimanana-andrianjafy@entreprise-ravinala-madagascar.test';
const DOMAINE_FAMILLES = 'famille.colibris.test';

interface Case { salle: SalleCtx; niveau: NiveauCtx }

export async function creerFamilles(ctx: Ctx): Promise<void> {
  const { prisma, alea } = ctx;
  const parSalle = Number(process.env.DEMO_ELEVES_PAR_SALLE ?? 10);
  const anneeDebut = ctx.annee.dateDebut.getUTCFullYear();

  // 1. Une case par élève : les niveaux d'une salle sont représentés à parts égales
  let cases: Case[] = [];
  for (const s of ctx.salles) {
    for (let i = 0; i < parSalle; i++) cases.push({ salle: s, niveau: s.niveaux[i % s.niveaux.length] });
  }
  cases = alea.melanger(cases);

  // 2. Regroupement en familles de 1 à 4 enfants, frères et sœurs dans des salles différentes si possible
  const groupes: Case[][] = [];
  let t = 0;
  while (cases.length > 0) {
    const taille = Math.min(TAILLES_FAMILLE[t++ % TAILLES_FAMILLE.length], cases.length);
    const fam: Case[] = [cases.shift() as Case];
    while (fam.length < taille) {
      const i = cases.findIndex((c) => !fam.some((f) => f.salle.id === c.salle.id));
      fam.push(...cases.splice(i === -1 ? 0 : i, 1));
    }
    groupes.push(fam);
  }

  // 3. Cas particuliers
  const seuls = alea.melanger(groupes.map((g, i) => (g.length === 1 ? i : -1)).filter((i) => i >= 0));
  const enAttente = new Set<number>(seuls.slice(0, 5));         // 5 inscriptions à valider (parents sans compte)
  const idxMereSansEmail = groupes.findIndex((g) => g.length === 2);
  const idxEmailLong = groupes.findIndex((g) => g.length === 3);

  let seqEleve = 0;
  for (let fi = 0; fi < groupes.length; fi++) {
    const fam = groupes[fi];
    const nomFamille = alea.choisir(NOMS);
    const attente = enAttente.has(fi);

    const pere = { prenom: alea.choisir(PRENOMS_M), nom: nomFamille };
    const mere = { prenom: alea.choisir(PRENOMS_F), nom: alea.proba(0.5) ? nomFamille : alea.choisir(NOMS) };
    let emailPere: string;
    if (fi === idxEmailLong) { emailPere = EMAIL_LONG; ctx.emailsPris.add(EMAIL_LONG); }
    else emailPere = emailUnique(ctx, `${pere.prenom}.${pere.nom}`, DOMAINE_FAMILLES);
    const emailMere = fi === idxMereSansEmail ? null : emailUnique(ctx, `${mere.prenom}.${mere.nom}`, DOMAINE_FAMILLES);

    const parentPere = await prisma.parent.create({ data: { nom: pere.nom, prenom: pere.prenom, telephone: telephone(alea), email: emailPere } });
    const parentMere = await prisma.parent.create({ data: { nom: mere.nom, prenom: mere.prenom, telephone: telephone(alea), email: emailMere } });

    const famille: FamilleCtx = {
      nom: nomFamille, parentIds: [parentPere.id, parentMere.id], parentUtilisateurIds: [], eleveIds: [], parentsAvecCompte: [],
    };

    // Comptes parents : créés seulement pour les familles dont l'inscription est validée
    // (les familles « en attente » les recevront lors de la validation : à tester dans l'application)
    if (!attente) {
      for (const [parent, p, email] of [[parentPere, pere, emailPere], [parentMere, mere, emailMere]] as const) {
        if (!email) continue;
        const u = await prisma.utilisateur.create({
          data: {
            email, motDePasseHash: ctx.hash, role: 'PARENT', parentId: parent.id, actif: true,
            derniereConnexion: alea.proba(0.6) ? new Date(ctx.maintenant.getTime() - alea.entier(2, 240) * 3600 * 1000) : null,
          },
        });
        famille.parentUtilisateurIds.push(u.id);
        famille.parentsAvecCompte.push({ parentId: parent.id, utilisateurId: u.id });
        ctx.comptes.push({ role: 'PARENT', email, libelle: `${p.prenom} ${p.nom} · famille ${nomFamille}` });
      }
    }

    // Enfants, du plus âgé (rang 1) au plus jeune
    const enfants = fam
      .map((c) => {
        const age = AGES[c.niveau.nom] ?? 6 + c.niveau.ordre;
        const naissance = enJour(ajouterJours(ctx.aujourdhui, -(age * 365 + alea.entier(0, 364))));
        return { c, age, naissance };
      })
      .sort((a, b) => a.naissance.getTime() - b.naissance.getTime());

    for (let k = 0; k < enfants.length; k++) {
      const { c, age, naissance } = enfants[k];
      seqEleve += 1;
      const sexe: 'M' | 'F' = alea.proba(0.5) ? 'F' : 'M';
      const prenom = alea.choisir(sexe === 'F' ? PRENOMS_F : PRENOMS_M);
      const expiree = alea.proba(0.15);

      const eleve = await prisma.eleve.create({
        data: {
          matricule: `ELV-${anneeDebut}-${pad(seqEleve, 4)}`,
          numeroInscription: `INS-${anneeDebut}-${pad(seqEleve, 4)}`,
          nom: nomFamille, prenom, sexe, dateNaissance: naissance,
          dateInscription: enJour(ajouterJours(ctx.aujourdhui, -alea.entier(60, 900))),
          taille: 90 + age * 6 + alea.entier(-4, 6),
          dossiersManquants: alea.proba(0.2) ? "Acte de naissance, 2 photos d'identité" : null,
          assurance: alea.proba(0.55) ? `NY HAVANA · police NH-${pad(alea.entier(0, 99999), 5)}` : null,
          assuranceExpiration: enJour(ajouterJours(ctx.aujourdhui, expiree ? -alea.entier(10, 60) : alea.entier(60, 330))),
          telephone: telephone(alea),
          email1: emailPere, email2: emailMere,
          quartier: alea.choisir(QUARTIERS),
          professionPere: alea.choisir(PROFESSIONS), professionMere: alea.choisir(PROFESSIONS),
          parents: {
            create: [
              { parentId: parentPere.id, lienParente: 'pere' },
              { parentId: parentMere.id, lienParente: 'mere' },
            ],
          },
        },
      });

      const debut = ctx.annee.dateDebut.getTime();
      const dateInscription = attente
        ? new Date(ctx.maintenant.getTime() - alea.entier(1, 10) * 86_400_000)
        : new Date(Math.min(debut + alea.entier(0, 30) * 86_400_000, ctx.maintenant.getTime() - 86_400_000));

      const insc = await prisma.inscription.create({
        data: {
          eleveId: eleve.id, salleId: c.salle.id, niveauId: c.niveau.id, anneeScolaireId: ctx.annee.id,
          rangFratrie: k + 1, statut: attente ? 'en_attente' : 'validee', dateInscription,
        },
      });

      famille.eleveIds.push(eleve.id);
      const e: EleveCtx = {
        eleveId: eleve.id, inscriptionId: insc.id, salleId: c.salle.id, niveauId: c.niveau.id, cycle: c.niveau.cycle,
        statut: attente ? 'en_attente' : 'validee', rang: k + 1, familleIdx: ctx.familles.length,
        nom: nomFamille, prenom, dateNaissance: naissance,
      };
      ctx.eleves.push(e);
    }
    ctx.familles.push(famille);
  }
}