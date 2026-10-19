import { Injectable, NotFoundException, ConflictException , BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEleveDto } from './dto/create-eleve.dto';
import { Prisma } from '@prisma/client';
import { UpdateEleveDto } from './dto/update-eleve.dto';
@Injectable()
export class ElevesService {
  constructor(private readonly prisma: PrismaService) {}

   private normaliser(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
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
  async ajouterParent(
    eleveId: number,
    data: { nom: string; prenom: string; telephone: string; email?: string; lienParente: string },
  ) {
    const eleve = await this.prisma.eleve.findUnique({ where: { id: eleveId } });
    if (!eleve) {
      throw new NotFoundException(`Élève #${eleveId} introuvable`);
    }

    let parent = await this.prisma.parent.findFirst({ where: { telephone: data.telephone } });
    if (!parent) {
      parent = await this.prisma.parent.create({
        data: { nom: data.nom, prenom: data.prenom, telephone: data.telephone, email: data.email },
      });
    }

    const dejaLie = await this.prisma.parentEleve.findUnique({
      where: { parentId_eleveId: { parentId: parent.id, eleveId } },
    });
    if (dejaLie) {
      throw new ConflictException('Ce parent est déjà associé à cet élève');
    }

    return this.prisma.parentEleve.create({
      data: { parentId: parent.id, eleveId, lienParente: data.lienParente },
      include: { parent: true },
    });
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