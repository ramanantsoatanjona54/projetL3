'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/context/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ForcerChangementMdp } from '@/components/ForcerChangementMdp';
import { ForcerActivation2fa } from '@/components/ForcerActivation2fa';
import { NotificationsLien } from '@/components/NotificationsLien';
import { InactiviteAlerte } from '@/components/InactiviteAlerte';
import { BasculeTheme } from '@/components/BasculeTheme';
import { Logo } from '@/components/Logo';
import { useEffect , useState } from 'react';
import { api } from '@/lib/api';

const LIBELLES_ROLE: Record<string, string> = {
  ADMIN: 'Administrateur',
  ENSEIGNANT: 'Enseignant',
  SECRETARIAT: 'Secrétariat',
  COMPTABLE: 'Comptable',
  DIRECTRICE: 'Directrice',
  PARENT: 'Parent',
};

interface LienMenu {
  href: string;
  libelle: string;
  exclure?: string[]; // chemins pour lesquels ce lien ne doit pas être surligné
}

// Le menu dépend du rôle. La vraie protection reste côté serveur (@Roles) : le menu n'est qu'un confort.
function liensPour(role: string, profil: { avecExamens: boolean } | null) {
  const communication: LienMenu[] = [
    { href: '/dashboard/annonces', libelle: 'Annonces' },
    { href: '/dashboard/menu', libelle: 'Menu' },
    { href: '/dashboard/dossiers', libelle: 'Documents' },
  ];

  if (role === 'PARENT') {
    return [
      {
        href: '/dashboard/parent',
        libelle: 'Mes enfants',
        exclure: [
          '/dashboard/parent/rendez-vous',
          '/dashboard/parent/remarques',
          '/dashboard/parent/annonces',
          '/dashboard/parent/menu',
        ],
      },
      { href: '/dashboard/parent/rendez-vous', libelle: 'Rendez-vous' },
      { href: '/dashboard/parent/remarques', libelle: 'Remarques' },
      { href: '/dashboard/parent/annonces', libelle: 'Annonces' },
      { href: '/dashboard/parent/menu', libelle: 'Menu' },
    ];
  }
  if (role === 'ENSEIGNANT') {
    return [
      { href: '/dashboard/absences', libelle: 'Absences' },
      { href: '/dashboard/evaluations', libelle: 'Évaluations' },
      ...(profil?.avecExamens ? [{ href: '/dashboard/examens-blancs', libelle: 'Examens blancs' }] : []),
      { href: '/dashboard/enseignant', libelle: 'Mon espace', exclure: ['/dashboard/enseignant/eleves'] },
      { href: '/dashboard/enseignant/eleves', libelle: 'Mes élèves' },
      ...communication,
      { href: '/dashboard/securite', libelle: 'Sécurité' },
    ];
  }

  const est = (...roles: string[]) => roles.includes(role);
  const liens: LienMenu[] = [];

    if (est('ADMIN', 'SECRETARIAT', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/eleves', libelle: 'Élèves' });
  }
  if (est('SECRETARIAT', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/inscriptions', libelle: 'Inscriptions' });
  }
  if (est('SECRETARIAT', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/absences', libelle: 'Absences' });
    liens.push({ href: '/dashboard/rendez-vous', libelle: 'Rendez-vous' });
  }
  if (est('ADMIN', 'SECRETARIAT', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/affectations', libelle: 'Affectations' });
  }
  if (est('ADMIN', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/remarques', libelle: 'Remarques' });
  }
  if (est('SECRETARIAT', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/finances/retards', libelle: 'Retards' });
  }
  if (est('ADMIN', 'COMPTABLE', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/finances/bareme', libelle: 'Tarifs' });
  }
  if (est('ADMIN')) {
    liens.push({ href: '/dashboard/structure', libelle: 'Structure' });
    liens.push({ href: '/dashboard/utilisateurs', libelle: 'Utilisateurs' });
  }
  if (est('ADMIN', 'COMPTABLE', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/personnel', libelle: 'Personnel' });
    liens.push({ href: '/dashboard/pointage', libelle: 'Pointage' });
  }
  if (est('DIRECTRICE', 'SECRETARIAT', 'COMPTABLE')) {
    liens.push({ href: '/dashboard/inventaire', libelle: 'Inventaire' });
  }
   if (est('DIRECTRICE')) {
    liens.push({ href: '/dashboard/evaluations', libelle: 'Évaluations' });
  }
  if (est('ADMIN', 'DIRECTRICE')) {
    liens.push({ href: '/dashboard/examens-blancs', libelle: 'Examens blancs' });
    liens.push({ href: '/dashboard/bulletins', libelle: 'Bulletins' });
  }
  liens.push({ href: '/dashboard/securite', libelle: 'Sécurité' });
  liens.push(...communication);
  if (est('ADMIN', 'DIRECTRICE')) {
    liens.push(
      { href: '/dashboard/audit', libelle: "Journal d'audit" },
      { href: '/dashboard/emploi-du-temps', libelle: 'Emploi du temps' },
      { href: '/dashboard/programmes', libelle: 'Programme' },
    );
  }
  return liens;
}

function LienNav({ href, libelle, exclure }: LienMenu) {
  const pathname = usePathname();
  const actif =
    (pathname === href || pathname.startsWith(`${href}/`)) &&
    !(exclure ?? []).some((x) => pathname === x || pathname.startsWith(`${x}/`));

  return (
    <Link
      href={href}
      aria-current={actif ? 'page' : undefined}
      className={`border-b-2 py-1 font-medium hover:text-primary ${
        actif ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
      }`}
    >
      {libelle}
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <InactiviteAlerte />
      <ForcerActivation2fa />
      <ForcerChangementMdp />
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { utilisateur, seDeconnecter } = useAuth();
  const role = utilisateur?.role ?? '';
    const [profilEns, setProfilEns] = useState<{ avecExamens: boolean } | null>(null);
  useEffect(() => {
    if (role !== 'ENSEIGNANT') return;
    api.get<{ avecExamens: boolean }>('/enseignant/profil').then(setProfilEns).catch(() => setProfilEns(null));
  }, [role]);
  const accueil = role === 'PARENT' ? '/dashboard/parent' : '/dashboard';

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={accueil} className="flex items-center gap-3">
            <Logo taille={36} decoratif />
            <span className="font-heading text-base font-semibold">
              Les Colibris
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {liensPour(role, profilEns).map((l) => (
              <LienNav key={l.href} href={l.href} libelle={l.libelle} exclure={l.exclure} />
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {utilisateur?.email}
          </span>

          {utilisateur && (
            <Badge variant="secondary">
              {LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}
            </Badge>
          )}

          <NotificationsLien />

          <Link
            href="/dashboard/mot-de-passe"
            className="text-sm hover:text-primary hover:underline"
          >
            Mon mot de passe
          </Link>
          <BasculeTheme />
          <Button variant="outline" size="sm" onClick={seDeconnecter}>
            Se déconnecter
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}