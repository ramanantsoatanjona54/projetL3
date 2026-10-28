import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

// ====================================================================
// Modèles Word de l'école (contrat de travail, avenant, attestation d'emploi)
// Les données variables viennent de la fiche du personnel et du formulaire.
// ====================================================================

export type ModeleDocument = 'contrat' | 'avenant' | 'attestation';
export const MODELES_DOCUMENT: ModeleDocument[] = ['contrat', 'avenant', 'attestation'];

// Coordonnées de l'employeur : un seul endroit à modifier si elles changent
export const EMPLOYEUR = {
  raisonSociale: 'SARL RANAVELA',
  ecole: 'Ecole Les Colibris',
  capital: '2 000 000 MGA',
  siege: '33 Avenue Gandhi Mahamasina',
  rcs: '2003B00832',
  nif: '3 000 601 092',
  stat: '85211 11 1996 0 10012',
  representante: 'Josette RANAVELA',
  qualiteRepresentante: 'Gérante',
  ville: 'Antananarivo',
};

export interface DonneesDocument {
  // Fiche du personnel
  nom: string;
  prenom: string;
  feminin: boolean;
  matricule: string;
  cin: string | null;
  adresse: string | null;
  poste: string;
  dateNaissance: Date | null;
  dateEmbauche: Date | null;
  dateDepart: Date | null;
  transportJour: number;
  // Formulaire
  nationalite: string;
  lieuNaissance: string | null;
  cinDelivrance: string | null;
  pere: string | null;
  mere: string | null;
  classification: string | null;
  dateEffet: Date | null;
  salaireBase: number | null;
  anciennete: number | null;
  natureContrat: 'CDI' | 'CDD';
  dateSignature: Date;
}

// ---------- Utilitaires de mise en forme ----------

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// Les dates sont stockées à minuit UTC : on lit les composantes UTC, sans décalage
export const dateFr = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const montantAr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar`;

const POLICE = 'Times New Roman';
const TAILLE = 23; // 11,5 pt

type Morceau = string | { g: string };

function runs(morceaux: Morceau[]): TextRun[] {
  return morceaux.map((m) => (typeof m === 'string'
    ? new TextRun({ text: m, font: POLICE, size: TAILLE })
    : new TextRun({ text: m.g, bold: true, font: POLICE, size: TAILLE })));
}

const P = (...m: Morceau[]) => new Paragraph({ children: runs(m), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } });
const PC = (...m: Morceau[]) => new Paragraph({ children: runs(m), alignment: AlignmentType.CENTER, spacing: { after: 120 } });
const ART = (t: string) => new Paragraph({
  children: [new TextRun({ text: t, bold: true, font: POLICE, size: TAILLE })],
  spacing: { before: 200, after: 100 }, keepNext: true,
});
const TIRET = (...m: Morceau[]) => new Paragraph({
  children: runs(m), alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 },
  indent: { left: 567, hanging: 283 },
});
const VIDE = () => new Paragraph({ children: [], spacing: { after: 240 } });
const TITRE = (t: string) => new Paragraph({
  children: [new TextRun({ text: t, bold: true, font: POLICE, size: 30 })],
  alignment: AlignmentType.CENTER, spacing: { before: 120, after: 320 },
});

const SANS_BORDURE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function signatures(gauche: Morceau[][], droite: Morceau[][]) {
  const cellule = (lignes: Morceau[][]) => new TableCell({
    borders: SANS_BORDURE, width: { size: 50, type: WidthType.PERCENTAGE },
    children: lignes.map((l) => new Paragraph({ children: runs(l), spacing: { after: 80 } })),
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...SANS_BORDURE, insideHorizontal: SANS_BORDURE.top, insideVertical: SANS_BORDURE.left },
    rows: [new TableRow({ children: [cellule(gauche), cellule(droite)] })],
  });
}

// ---------- Accords grammaticaux ----------

function termes(d: DonneesDocument) {
  const f = d.feminin;
  const prenomNom = `${d.prenom} ${d.nom.toUpperCase()}`;
  return {
    f,
    civilite: f ? 'Madame' : 'Monsieur',
    nomComplet: prenomNom,
    e: f ? 'e' : '',
    employe: f ? 'employée' : 'employé',
    Employe: f ? 'Employée' : 'Employé',
    EMPLOYE: f ? 'EMPLOYEE' : 'EMPLOYE',
    ne: f ? 'née' : 'né',
    il: f ? 'elle' : 'il',
    Il: f ? 'Elle' : 'Il',
    fonction: d.poste.toLowerCase(),
    fonctionAccordee: (() => {
      const p = d.poste.toLowerCase();
      if (!f) return p;
      if (p === 'enseignant') return 'enseignante';
      if (p === 'assistant') return 'assistante';
      return p;
    })(),
  };
}

const identiteCin = (d: DonneesDocument) => (d.cin ? `titulaire de la carte d’identité nationale n° ${d.cin}` : '');
const naissance = (d: DonneesDocument, t: ReturnType<typeof termes>) => {
  if (!d.dateNaissance) return '';
  return `${t.ne} le ${dateFr(d.dateNaissance)}${d.lieuNaissance ? ` à ${d.lieuNaissance}` : ''}`;
};
const filiation = (d: DonneesDocument, t: ReturnType<typeof termes>) => {
  const p = [d.pere, d.mere].filter(Boolean);
  if (p.length === 0) return '';
  return `${t.f ? 'fille' : 'fils'} de ${p.join(' et ')}`;
};
const joindre = (...parties: (string | null | undefined)[]) => parties.filter((x): x is string => !!x && x.length > 0).join(', ');

// ---------- Bloc employeur ----------

const employeurIdentite = () =>
  `La société ${EMPLOYEUR.raisonSociale}, au capital de ${EMPLOYEUR.capital} ayant son siège social au ${EMPLOYEUR.siege}, ` +
  `immatriculée au registre du commerce et des sociétés d’${EMPLOYEUR.ville} sous le numéro ${EMPLOYEUR.rcs}, ` +
  `portant le numéro d’identification fiscale ${EMPLOYEUR.nif} et le numéro d’identification statistique ${EMPLOYEUR.stat}, ` +
  `représentée par sa ${EMPLOYEUR.qualiteRepresentante} Madame ${EMPLOYEUR.representante}`;

// ====================================================================
// 1) CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE
// ====================================================================
function contrat(d: DonneesDocument): (Paragraph | Table)[] {
  const t = termes(d);
  const prise = d.dateEffet ?? d.dateEmbauche;
  const corps: (Paragraph | Table)[] = [];
  const add = (...x: (Paragraph | Table)[]) => corps.push(...x);

  add(
    TITRE('CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE'),
    P('Entre les soussignés :'),
    P(employeurIdentite() + '.'),
    P('Ci-après désignée la « SOCIÉTÉ ».'),
    P(
      'Et ', { g: `${t.civilite} ${t.nomComplet}` },
      ', ', joindre(
        `de nationalité ${d.nationalite}`, naissance(d, t), identiteCin(d), filiation(d, t),
        d.adresse ? `habitant au ${d.adresse}` : null,
      ), '.',
    ),
    P(`Ci-après désigné${t.e} « L’${t.EMPLOYE} ».`),

    ART('Article 1 : FONCTIONS'),
    P(`La société ${EMPLOYEUR.raisonSociale} engage ${t.civilite} ${t.nomComplet} pour servir d’« ${t.fonctionAccordee} » matricule N° ${d.matricule}.`),
    P('Elle assurera les tâches et responsabilités liées à son poste ainsi que les autres tâches qui lui seront assignées.'.replace('Elle', t.Il)),
    P(
      `${t.civilite} ${t.nomComplet} est classé${t.e} ${d.classification ?? ''} conformément à la classification prévue par le décret n° 2007-009 du 9 janvier 2007 ` +
      'déterminant les conditions et la durée de préavis de résiliation du contrat de travail à durée indéterminée.',
    ),
    P('La société peut, suivant son appréciation, augmenter ou réduire de temps en temps les tâches et responsabilités ou modifier le titre et la description du poste.'),

    ART('Article 2 : ACCEPTATION DE L’EMPLOI'),
    P(
      `L’${t.employe} accepte son emploi conformément aux conditions prévues ci-dessus et s’engage à consacrer son temps, son énergie et ses capacités ` +
      'aux intérêts de la société et à assumer ses responsabilités de façon efficiente, fiable et professionnelle.',
    ),

    ART(`Article 3 : OBLIGATIONS DE L’${t.EMPLOYE}`),
    P(`L’${t.employe} devra consacrer ses efforts et ses heures de travail à assurer ses responsabilités au nom de la société ; ${t.il} devra fournir les services durant les heures normales de travail.`),
    P(`En vue de sauvegarder les intérêts légitimes de la société, l’${t.employe} s’engage à respecter les obligations suivantes :`),
    TIRET('- Donner et maintenir une image de marque de la société vis-à-vis des tiers ;'),
    TIRET('- Atteindre les objectifs fixés ;'),
    TIRET('- Assurer le bon fonctionnement de son travail ;'),
    TIRET('- Rendre compte en temps réel des informations ;'),
    TIRET('- Proposer des suggestions d’amélioration permanentes.'),
    P(`L’${t.employe} s’engage à défendre et développer les intérêts moraux et matériels de la société par la qualité de son travail.`),

    ART('Article 4 : QUALIFICATIONS'),
    P(`L’${t.employe} devra, comme condition au présent contrat, répondre aux exigences en matière de qualifications établies par la Direction.`),

    ART('Article 5 : DURÉE DU CONTRAT'),
    P(
      'Le présent contrat est conclu pour une durée indéterminée et est entré en vigueur le ',
      { g: prise ? dateFr(prise) : '__ ______ ____' },
      `, date de prise de service effective de l’${t.employe}.`,
    ),
    P('Il comporte une période d’essai de trois mois renouvelable une fois.'),

    ART('Article 6 : PROPRIÉTÉ DE LA SOCIÉTÉ'),
    P(
      `L’${t.employe} reconnaît et s’engage à ce que, pendant la durée de son contrat avec la société, ${t.il} soit autorisé${t.e} à utiliser les matériels et biens de la société. ` +
      'L’utilisation et la possession desdits biens seront sujettes aux politiques, conditions et restrictions établies par la société.',
    ),
    P(`Lesdits biens ne seront utilisés que dans l’accomplissement des tâches de l’${t.employe} pour le compte de la société.`),
    P(
      `En cas de fin de contrat, toutes causes confondues, l’${t.employe} aura l’obligation de retourner lesdits biens à la société, que la demande en soit faite ou non. ` +
      'L’obligation de retourner les biens de la société s’étend à tous les produits du travail et à tous les autres biens de la société, quelle qu’en soit la forme ou le moyen.',
    ),

    ART('Article 7 : RÉMUNÉRATION'),
    P({ g: '7.1 Salaire' }),
    P(`${t.civilite} ${t.nomComplet} percevra la rémunération brute suivante :`),
    TIRET('a) base mensuelle : ', { g: d.salaireBase !== null ? montantAr(d.salaireBase) : '____ Ar' }),
  );
  if (d.transportJour > 0) {
    add(TIRET('b) avantages :'), TIRET('    - déplacement : ', { g: `${montantAr(d.transportJour)}/jour` }));
  }
  add(
    P(`Le salaire net perçu par l’${t.employe} sera le salaire brut déduit de :`),
    TIRET('- la CNaPS (1 %) ;'),
    TIRET('- la SMIE (1 %) ;'),
    TIRET('- l’IRSA suivant le barème porté sur la feuille de paie.'),
    P({ g: '7.2 Paiement' }),
    P('Le paiement de toutes les rémunérations prévues par le présent contrat se fera conformément aux politiques et procédures fixées par la société en la matière.'),

    ART('Article 8 : CNaPS, SMIE ET IMPÔT'),
    P(`Il sera prélevé mensuellement sur le salaire brut de l’${t.employe} :`),
    TIRET('- 1 % du salaire brut : part de l’employé pour la CNaPS, sous réserve du respect du plafond mensuel fixé par la réglementation en vigueur ;'),
    TIRET('- 1 % du salaire brut pour la SMIE ;'),
    TIRET('- l’impôt sur les revenus salariaux (IRSA).'),
    P('Le net à payer sera le salaire brut diminué des déductions réglementaires ci-dessus.'),

    ART('Article 9 : CONGÉ'),
    P(`L’${t.employe} a droit au congé payé de deux jours et demi calendaires par mois de service effectif. Le droit au congé est acquis après 12 mois de service effectif.`),
    P(`Le départ en congé sera soumis à l’accord de la Direction, pourvu que la programmation des congés de l’${t.employe} ne porte pas préjudice au fonctionnement normal de la société.`),
    P(`En cas de rupture du contrat de travail avant que l’${t.employe} n’ait acquis le droit de jouissance aux congés, une indemnité calculée sur la base des droits acquis sera accordée en lieu et place du congé.`),

    ART('Article 10 : ADRESSE DE FONCTION'),
    P(`L’adresse principale où l’${t.employe} assurera ses services sera située au ${EMPLOYEUR.siege}.`),
    P('Tout changement de ce lieu de travail au sein du même secteur géographique ne constitue pas une modification du contrat de travail.'),

    ART('Article 11 : HORAIRES DE TRAVAIL'),
    P('Les horaires sont fixés de 07h15 à 16h15 le lundi, mardi, mercredi et vendredi.'),
    P('Le jeudi pourra être un jour travaillé ou non ; cette décision ainsi que les horaires seront fixés discrétionnairement par la Direction.'),

    ART('Article 12 : POLITIQUES ET PROCÉDURES'),
    P(
      'La société aura l’autorité d’établir les politiques et procédures à suivre dans l’accomplissement des tâches. Cela suppose, entre autres, les politiques du personnel, ' +
      'les politiques d’utilisation de l’outil informatique, d’accès à internet, d’utilisation du courrier électronique, ainsi que toutes les autres politiques, procédures, ' +
      'directives et mandats établis par la société, qu’ils soient écrits ou formellement adoptés.',
    ),

    ART('Article 13 : RUPTURE DU CONTRAT DE TRAVAIL'),
    P('La rupture de ce contrat de travail, soit par l’effet de la démission, soit par l’effet du licenciement, sera régie par la réglementation en vigueur.'),
    P('Toutefois, la rupture peut être prononcée en cas de faute lourde prévue par le règlement intérieur ou, à défaut, par la juridiction compétente.'),
    P(`L’${t.employe} est classé${t.e} dans le groupe III prescrit par le décret 2007-009 du 9 janvier 2007 déterminant les conditions et la durée du préavis de résiliation du contrat de travail à durée indéterminée.`),
    P({ g: '13.1 Obligation de coopération' }),
    P(`Après notification de fin de contrat, toutes causes confondues, l’${t.employe} devra coopérer avec la société autant que cela sera demandé pour faciliter la passation de poste.`),
    P(`L’${t.employe} continuera de consacrer son temps à ses tâches habituelles pour le compte de la société pendant la période de préavis.`),
    P({ g: `13.2 Invalidité de l’${t.employe}` }),
    P(
      `Le présent contrat sera automatiquement rompu si l’${t.employe} est définitivement ou partiellement invalide, de manière continue ou discontinue, dans l’accomplissement de ses tâches ` +
      'pour raison de maladie ou d’un handicap physique ou mental, si la période d’invalidité dépasse six (6) mois.',
    ),
    P(`Au cours de la première période d’invalidité d’un (1) mois, l’${t.employe} percevra de la part de la société son salaire normal.`),
    P(`En cas de fin de contrat pour raison d’invalidité, c’est-à-dire au-delà de 6 mois, l’${t.employe} bénéficiera de son solde de tout compte.`),
    P(`Nonobstant ce qui précède, si l’${t.employe} invalide et la société en conviennent, la personne peut être toujours employée par la société, mais suivant les conditions qui seront mutuellement convenues entre les deux parties.`),
    P(`La date de début d’une période d’invalidité, qu’elle soit continue ou une addition de périodes partielles successives, sera le premier jour d’invalidité de l’${t.employe}.`),
    P({ g: `13.3 Décès de l’${t.employe}` }),
    P(
      `Si l’${t.employe} décède pendant la durée du présent contrat, la société paiera au conjoint survivant le salaire, le préavis et les indemnités compensatrices de congé qui n’ont pas été payés ` +
      'à la date du décès. S’il n’y a pas de conjoint, la somme due sera versée aux héritiers.',
    ),

    ART('Article 14 : CONFIDENTIALITÉ'),
    P(`L’${t.employe} reconnaît et s’engage à ce que toutes les données relatives aux activités de la société et toutes les informations mises à sa disposition soient confidentielles et ne soient pas révélées à des tiers.`),

    ART('Article 15 : AVENANT'),
    P('Le présent contrat ne peut être complété, suppléé, amendé ou modifié que par écrit entre les parties.'),

    ART('Article 16 : DROIT APPLICABLE'),
    P('Tout différend se rapportant à la validité, la caducité, la nullité, l’interprétation, l’exécution ou la résiliation du présent contrat sera soumis exclusivement à l’application du droit malgache.'),
    P('Les parties se soumettront à la compétence exclusive du Tribunal du Travail d’Antananarivo pour tout contentieux en relation avec ce contrat.'),
    P('En foi de quoi, les parties ont signé le présent contrat à la date indiquée ci-dessous.'),
    P(`Fait au siège de la société ${EMPLOYEUR.raisonSociale} en deux exemplaires, dont l’un a été remis à l’${t.employe} qui le reconnaît et l’autre est conservé par la société et le restera dans tous les cas.`),
    P(`Fait à ${EMPLOYEUR.ville}, le ${dateFr(d.dateSignature)}`),
    VIDE(),
    signatures(
      [[{ g: `L’${t.Employe}` }], ['(Signature précédée de la mention « lu et approuvé »)'], [''], [''], [{ g: t.nomComplet }]],
      [[{ g: 'L’Employeur' }], ['(Signature précédée de la mention « lu et approuvé »)'], [''], [''], [{ g: `${EMPLOYEUR.raisonSociale} représentée par sa ${EMPLOYEUR.qualiteRepresentante} ${EMPLOYEUR.representante}` }]],
    ),
  );
  return corps;
}

// ====================================================================
// 2) AVENANT AU CONTRAT DE TRAVAIL
// ====================================================================
function avenant(d: DonneesDocument): (Paragraph | Table)[] {
  const t = termes(d);
  return [
    TITRE('AVENANT AU CONTRAT DE TRAVAIL'),
    P('Entre les soussignés,'),
    P(employeurIdentite() + '.'),
    P('Ci-après désignée « l’Employeur »'),
    P('D’une part,'),
    P('ET'),
    P(
      `${t.civilite} `, { g: t.nomComplet }, ', ', joindre(
        `de nationalité ${d.nationalite}`, naissance(d, t),
        d.cin ? `titulaire de la carte d’identité nationale n° ${d.cin}${d.cinDelivrance ? `, ${d.cinDelivrance}` : ''}` : null,
        d.adresse ? `résidant au ${d.adresse}` : null,
      ), '.',
    ),
    P(`Ci-après dénommé${t.e} « l’${t.Employe} »`),
    P('D’autre part,'),
    P('Il a été convenu et arrêté ce qui suit :'),

    ART('Article 1 : Nature du contrat'),
    P(
      'Le présent avenant au contrat de travail est établi pour une durée indéterminée et prend effet à compter du ',
      { g: d.dateEffet ? dateFr(d.dateEffet) : '__ ______ ____' }, '.',
    ),

    ART('Article 2 : Rémunération'),
    P(`L’${t.Employe} ${t.civilite} ${t.nomComplet} percevra la rémunération brute détaillée ci-après :`),
    TIRET('- Salaire mensuel de base : ', { g: d.salaireBase !== null ? montantAr(d.salaireBase) : '____ Ar' }),
    TIRET('- Ancienneté : ', { g: d.anciennete !== null ? montantAr(d.anciennete) : '____ Ar' }),
    P(`Le salaire net perçu par l’${t.employe} sera le salaire brut déduit de :`),
    TIRET('- la CNaPS (1 %) ;'),
    TIRET('- la SMIE (1 %) ;'),
    TIRET('- l’IRSA suivant le barème porté sur la fiche de paie.'),

    ART('Article 3 : Dispositions générales'),
    P('Les autres dispositions du contrat demeurent inchangées.'),
    P(`Fait à ${EMPLOYEUR.ville}, en deux exemplaires originaux, le ${dateFr(d.dateSignature)}.`),
    VIDE(),
    signatures(
      [[{ g: `L’${t.Employe}` }], [''], [''], [{ g: t.nomComplet }], ['(Signature précédée de la mention « lu et approuvé »)']],
      [[{ g: 'L’Employeur' }], [''], [''], [{ g: `${EMPLOYEUR.raisonSociale} représentée par sa ${EMPLOYEUR.qualiteRepresentante} ${EMPLOYEUR.representante}` }]],
    ),
  ];
}

// ====================================================================
// 3) ATTESTATION D'EMPLOI
// ====================================================================
function attestation(d: DonneesDocument): (Paragraph | Table)[] {
  const t = termes(d);
  const depuis = d.dateEmbauche ? dateFr(d.dateEmbauche) : '__ ______ ____';
  const parti = d.dateDepart !== null && d.dateDepart.getTime() < Date.now();
  const contrat = d.natureContrat === 'CDD'
    ? 'contrat de travail à durée déterminée (CDD)'
    : 'contrat de travail à durée indéterminée (CDI)';

  const periode = parti
    ? `a été ${t.employe} en qualité d’${t.fonctionAccordee} au sein de notre société du ${depuis} au ${dateFr(d.dateDepart as Date)}`
    : `est ${t.employe} en qualité d’${t.fonctionAccordee} au sein de notre société depuis le ${depuis} jusqu’à ce jour`;

  return [
    TITRE('ATTESTATION D’EMPLOI'),
    P(
      `Je soussignée, Madame ${EMPLOYEUR.representante}, ${EMPLOYEUR.qualiteRepresentante.toLowerCase()} de la société ${EMPLOYEUR.raisonSociale} « ${EMPLOYEUR.ecole} », ` +
      `établie au ${EMPLOYEUR.siege} et immatriculée sous le numéro ${EMPLOYEUR.rcs}, atteste et certifie que ${t.civilite} `,
      { g: t.nomComplet },
      ` ${joindre(naissance(d, t), d.adresse ? `demeurant au ${d.adresse}` : null, identiteCin(d))} `,
      `${periode}, et immatricul${t.e === 'e' ? 'ée' : 'é'} sous le numéro ${d.matricule}.`,
    ),
    ...(parti ? [] : [
      P(`Titulaire d’un ${contrat}, ${t.il} n’est actuellement ni démissionnaire ni en procédure de licenciement.`),
    ]),
    P(`Fait à ${EMPLOYEUR.ville}, le ${dateFr(d.dateSignature)}, pour servir et valoir ce que de droit.`),
    VIDE(),
    new Paragraph({ children: [new TextRun({ text: `La ${EMPLOYEUR.qualiteRepresentante}`, bold: true, font: POLICE, size: TAILLE })], alignment: AlignmentType.RIGHT, spacing: { after: 600 } }),
    new Paragraph({ children: [new TextRun({ text: EMPLOYEUR.representante, bold: true, font: POLICE, size: TAILLE })], alignment: AlignmentType.RIGHT }),
  ];
}

// ====================================================================
// Assemblage
// ====================================================================

export const NOMS_FICHIER: Record<ModeleDocument, string> = {
  contrat: 'Contrat de travail',
  avenant: 'Avenant au contrat',
  attestation: 'Attestation d’emploi',
};

export async function construireDocument(modele: ModeleDocument, d: DonneesDocument): Promise<Buffer> {
  const enfants = modele === 'contrat' ? contrat(d) : modele === 'avenant' ? avenant(d) : attestation(d);
  const doc = new Document({
    creator: EMPLOYEUR.raisonSociale,
    title: NOMS_FICHIER[modele],
    styles: { default: { document: { run: { font: POLICE, size: TAILLE } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1304, right: 1304 } } },
      children: enfants,
    }],
  });
  return Packer.toBuffer(doc);
}