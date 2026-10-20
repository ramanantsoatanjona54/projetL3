'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/context/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ForcerChangementMdp } from '@/components/ForcerChangementMdp';
import { NotificationsLien } from '@/components/NotificationsLien';

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
}

// Le menu dépend du rôle. La vraie protection reste côté serveur (@Roles) : le menu n'est qu'un confort.
function liensPour(role: string): LienMenu[] {
  if (role === 'PARENT') {
    return [{ href: '/dashboard/parent', libelle: 'Mes enfants' }];
  }
  if (role === 'ENSEIGNANT') {
    return [{ href: '/dashboard/absences', libelle: 'Absences' }];
  }

  const direction = ['ADMIN', 'COMPTABLE', 'DIRECTRICE'].includes(role);
  const liens: LienMenu[] = [
    { href: '/dashboard/eleves', libelle: 'Élèves' },
    { href: '/dashboard/inscriptions', libelle: 'Inscriptions' },
  ];
  if (['ADMIN', 'SECRETARIAT', 'DIRECTRICE'].includes(role)) {
    liens.push({ href: '/dashboard/absences', libelle: 'Absences' });
  }
  if (direction) {
    liens.push({ href: '/dashboard/finances/retards', libelle: 'Retards' });
    liens.push({ href: '/dashboard/finances/bareme', libelle: 'Tarifs' });
  }
  if (role === 'ADMIN') {
    liens.push({ href: '/dashboard/structure', libelle: 'Structure' });
    liens.push({ href: '/dashboard/utilisateurs', libelle: 'Utilisateurs' });
  }
  if (direction) {
    liens.push({ href: '/dashboard/personnel', libelle: 'Personnel' });
    liens.push({ href: '/dashboard/pointage', libelle: 'Pointage' });
  }
  if (role === 'ADMIN' || role === 'DIRECTRICE') {
    liens.push({ href: '/dashboard/audit', libelle: "Journal d'audit" });
  }
  return liens;
}

function LienNav({ href, libelle }: LienMenu) {
  const pathname = usePathname();
  const actif = pathname === href || pathname.startsWith(`${href}/`);

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
      <ForcerChangementMdp />
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { utilisateur, seDeconnecter } = useAuth();
  const role = utilisateur?.role ?? '';
  const accueil = role === 'PARENT' ? '/dashboard/parent' : '/dashboard';

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={accueil} className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              LC
            </span>
            <span className="font-heading text-base font-semibold">
              Les Colibris
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {liensPour(role).map((l) => (
              <LienNav key={l.href} href={l.href} libelle={l.libelle} />
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