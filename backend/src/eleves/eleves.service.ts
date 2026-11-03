import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEleveDto } from './dto/create-eleve.dto';
import { Prisma } from '@prisma/client';
import { UpdateEleveDto } from './dto/update-eleve.dto';

// Un élève a au plus 3 responsables : un père, une mère, un tuteur
const MAX_RESPONSABLES = 3;
const NOM_LIEN: Record<string, string> = { pere: 'père', mere: 'mère', tuteur: 'tuteur' };

@Injectable()
export class ElevesService {
  constructor(private readonly prisma: PrismaService) {}

  private normaliser(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Ne garde que les chiffres : "034 12 345 67" et "0341234567" sont le même numéro
  private chiffres(s?: string | null): string {
    return (s ?? '').replace(/\D/g, '');
  }

  // Prend le plus grand numéro de l'année et ajoute 1 (le count() se trompait après une suppression)
  private async genererMatricule(): Promise<string> {
    const prefixe = `ELV-${new Date().getFullYear()}-`;
    const dernier = await this.prisma.eleve.findFirst({
      where: { matricule: { startsWith: prefixe } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true },
    });
    const suivant = dernier ? parseInt(dernier.matricule.slice(prefixe.length), 10) + 1 : 1;
    return `${prefixe}${String(suivant).padStart(4, '0')}`;
  }

  async creerEleve(dto: CreateEleveDto) {
    const { confirmerHomonyme, ...donnees } = dto;
    const dateNaissance = new Date(dto.dateNaissance);

    // Anti-doublon : on ne charge que les élèves nés le même jour (très peu de lignes),
    // puis on compare les noms sans accents ni casse
    if (!confirmerHomonyme) {
      const memeDate = await this.prisma.eleve.findMany({
        where: { dateNaissance },
        select: { matricule: true, nom: true, prenom: true },
      });
      const cle = this.normaliser(`${dto.nom} ${dto.prenom}`);
      const doublon = memeDate.find((e) => this.normaliser(`${e.nom} ${e.prenom}`) === cle);
      if (doublon) {
        throw new ConflictException(
          `Un élève ${doublon.nom} ${doublon.prenom} né(e) à cette date existe déjà ` +
            `(matricule ${doublon.matricule}). S'il s'agit d'un homonyme, confirmez-le explicitement.`,
        );
      }
    }

    // Réessaie si deux inscriptions simultanées génèrent le même matricule
    for (let essai = 0; essai < 3; essai++) {
      const matricule = await this.genererMatricule();
      try {
        return await this.prisma.eleve.create({
          data: {
            ...donnees,
            matricule,
            dateNaissance,
            dateInscription: dto.dateInscription ? new Date(dto.dateInscription) : undefined,
            assuranceExpiration: dto.assuranceExpiration ? new Date(dto.assuranceExpiration) : undefined,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const cible = JSON.stringify(e.meta ?? {});
          if (cible.includes('numeroInscription')) {
            throw new ConflictException(`Le numéro d'inscription "${dto.numeroInscription}" est déjà utilisé`);
          }
          if (cible.includes('matricule')) continue; // collision de matricule : nouvel essai
        }
        throw e;
      }
    }
    throw new ConflictException('Impossible de générer un matricule unique, veuillez réessayer.');
  }

  listerEleves() {
    return this.prisma.eleve.findMany({
      include: {
        parents: { include: { parent: true } },
        inscriptions: { include: { salle: true, niveau: true } },
      },
    });
  }

  rechercherEleve(id: number) {
    return this.prisma.eleve.findUnique({
      where: { id },
      include: {
        parents: { include: { parent: true } },
        inscriptions: { include: { salle: true, niveau: true, anneeScolaire: true } },
      },
    });
  }

  // Réutilise un Parent existant (identifié par son téléphone, pris comme clé
  // naturelle) s'il a déjà un enfant inscrit à l'école, pour éviter de dupliquer
  // ses informations (nom/téléphone/email) à chaque nouvel enfant. Sinon, crée
  // un nouveau Parent. Dans les deux cas, relie ensuite ce Parent à l'élève via
  // ParentEleve (table de jonction), avec la nature du lien (père/mère/tuteur).
  //
  // Règles : 3 responsables au maximum, un seul par nature de lien (un père, une mère, un tuteur).
  async ajouterParent(
    eleveId: number,
    data: { nom: string; prenom: string; telephone: string; email?: string; lienParente: string },
  ) {
    const eleve = await this.prisma.eleve.findUnique({
      where: { id: eleveId },
      include: { parents: true },
    });
    if (!eleve) {
      throw new NotFoundException(`Élève #${eleveId} introuvable`);
    }
    if (eleve.parents.length >= MAX_RESPONSABLES) {
      throw new ConflictException(
        'Cet élève a déjà 3 responsables (père, mère, tuteur). Retirez-en un avant d\'en ajouter un autre.',
      );
    }
    if (eleve.parents.some((l) => l.lienParente === data.lienParente)) {
      throw new ConflictException(
        `Cet élève a déjà un ${NOM_LIEN[data.lienParente] ?? data.lienParente} enregistré. ` +
          'Retirez-le d\'abord si vous voulez le remplacer.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        let parent = await tx.parent.findFirst({ where: { telephone: data.telephone } });
        if (!parent) {
          parent = await tx.parent.create({
            data: { nom: data.nom, prenom: data.prenom, telephone: data.telephone, email: data.email },
          });
        }

        if (eleve.parents.some((l) => l.parentId === parent!.id)) {
          throw new ConflictException('Ce parent est déjà associé à cet élève');
        }

        const lien = await tx.parentEleve.create({
          data: { parentId: parent.id, eleveId, lienParente: data.lienParente },
          include: { parent: true },
        });

        // Premier responsable ajouté : son numéro devient le contact de la famille
        if (!eleve.telephone) {
          await tx.eleve.update({ where: { id: eleveId }, data: { telephone: parent.telephone } });
        }
        return lien;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Ce responsable vient d\'être ajouté par un autre utilisateur. Actualisez la fiche et réessayez.',
        );
      }
      throw e;
    }
  }

  // Retire le lien entre un parent et un élève (le parent lui-même est conservé s'il a
  // un compte, d'autres enfants, des remarques ou des rendez-vous). Réservé à l'administrateur.
  // Conséquence : un parent retiré perd l'accès à cet enfant dans son espace.
  async retirerParent(eleveId: number, parentId: number) {
    const lien = await this.prisma.parentEleve.findUnique({
      where: { parentId_eleveId: { parentId, eleveId } },
      include: { parent: true, eleve: { select: { telephone: true } } },
    });
    if (!lien) throw new NotFoundException('Ce parent n\'est pas associé à cet élève.');

    const contact = this.chiffres(lien.eleve.telephone);
    if (contact && contact === this.chiffres(lien.parent.telephone)) {
      throw new ConflictException(
        'Ce numéro est le contact de la famille de cet élève. Modifiez d\'abord le contact de la famille ' +
          '(fiche élève, bouton Modifier), puis retirez ce responsable.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.parentEleve.delete({ where: { parentId_eleveId: { parentId, eleveId } } });

      // Évite de laisser un parent orphelin (sans enfant, sans compte, sans historique)
      const reste = await tx.parent.findUnique({
        where: { id: parentId },
        select: {
          utilisateur: { select: { id: true } },
          _count: { select: { enfants: true, remarques: true, rendezVous: true } },
        },
      });
      if (
        reste && !reste.utilisateur &&
        reste._count.enfants === 0 && reste._count.remarques === 0 && reste._count.rendezVous === 0
      ) {
        await tx.parent.delete({ where: { id: parentId } });
      }
    });
    return { retire: true };
  }

  // Le contact de la famille doit être le numéro du père, de la mère ou du tuteur
  private async verifierContactFamille(eleveId: number, telephone: string) {
    const liens = await this.prisma.parentEleve.findMany({
      where: { eleveId },
      include: { parent: { select: { telephone: true } } },
    });
    if (liens.length === 0) {
      throw new BadRequestException(
        'Ajoutez d\'abord le père, la mère ou le tuteur : le contact de la famille doit être l\'un de leurs numéros.',
      );
    }
    const cible = this.chiffres(telephone);
    if (!liens.some((l) => this.chiffres(l.parent.telephone) === cible)) {
      throw new BadRequestException(
        'Le contact de la famille doit être le numéro du père, de la mère ou du tuteur de cet élève.',
      );
    }
  }

  private readonly CHAMPS_DATE = ['dateNaissance', 'dateInscription', 'assuranceExpiration'];
  private readonly CHAMPS_OBLIGATOIRES = ['nom', 'prenom', 'sexe', 'dateNaissance'];

  async modifierEleve(id: number, dto: UpdateEleveDto, utilisateurId?: number) {
    const avant = await this.prisma.eleve.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException(`Élève #${id} introuvable`);

    const { confirmerHomonyme, ...champs } = dto;
    const donnees: Record<string, unknown> = {};
    for (const [cle, valeur] of Object.entries(champs)) {
      if (valeur === undefined) continue;
      if (valeur === null && this.CHAMPS_OBLIGATOIRES.includes(cle)) {
        // formulation volontairement reconnue par le traducteur d'erreurs du frontend
        throw new BadRequestException(`${cle} should not be empty`);
      }
      donnees[cle] =
        valeur !== null && this.CHAMPS_DATE.includes(cle) ? new Date(valeur as string) : valeur;
    }

    // Anti-doublon : seulement si l'identité (nom, prénom, date de naissance) change,
    // et en excluant l'élève lui-même
    const nom = (donnees.nom as string | undefined) ?? avant.nom;
    const prenom = (donnees.prenom as string | undefined) ?? avant.prenom;
    const naissance = (donnees.dateNaissance as Date | undefined) ?? avant.dateNaissance;
    const identiteChangee =
      this.normaliser(`${nom} ${prenom}`) !== this.normaliser(`${avant.nom} ${avant.prenom}`) ||
      naissance.getTime() !== avant.dateNaissance.getTime();

    if (identiteChangee && !confirmerHomonyme) {
      const memeDate = await this.prisma.eleve.findMany({
        where: { dateNaissance: naissance, id: { not: id } },
        select: { matricule: true, nom: true, prenom: true },
      });
      const cle = this.normaliser(`${nom} ${prenom}`);
      const doublon = memeDate.find((e) => this.normaliser(`${e.nom} ${e.prenom}`) === cle);
      if (doublon) {
        throw new ConflictException(
          `Un élève ${doublon.nom} ${doublon.prenom} né(e) à cette date existe déjà ` +
            `(matricule ${doublon.matricule}). S'il s'agit d'un homonyme, confirmez-le explicitement.`,
        );
      }
    }

    // Différences réelles uniquement (ce qui sera journalisé)
    const simple = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null));
    const changements: Record<string, { avant: unknown; apres: unknown }> = {};
    for (const [cle, apres] of Object.entries(donnees)) {
      const ancien = simple((avant as Record<string, unknown>)[cle]);
      const nouveau = simple(apres);
      if (ancien !== nouveau) changements[cle] = { avant: ancien, apres: nouveau };
    }
    if (Object.keys(changements).length === 0) return avant; // rien à écrire, rien à journaliser

    // Règle : le contact de la famille doit être celui du père, de la mère ou du tuteur.
    // Contrôlé seulement si le numéro change (une fiche ancienne reste modifiable pour le reste).
    const nouveauContact = changements.telephone?.apres;
    if (typeof nouveauContact === 'string' && nouveauContact.trim() !== '') {
      await this.verifierContactFamille(id, nouveauContact);
    }

    const data = Object.fromEntries(Object.keys(changements).map((k) => [k, donnees[k]]));

    try {
      // Modification + journal dans UNE transaction : l'un n'existe jamais sans l'autre
      const [apres] = await this.prisma.$transaction([
        this.prisma.eleve.update({ where: { id }, data: data as Prisma.EleveUpdateInput }),
        this.prisma.journalAudit.create({
          data: {
            utilisateurId,
            action: 'ELEVE_MODIFIE',
            entite: 'Eleve',
            entiteId: id,
            details: changements as Prisma.InputJsonValue,
          },
        }),
      ]);
      return apres;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        JSON.stringify(e.meta ?? {}).includes('numeroInscription')
      ) {
        throw new ConflictException(`Le numéro d'inscription "${dto.numeroInscription}" est déjà utilisé`);
      }
      throw e;
    }
  }
}