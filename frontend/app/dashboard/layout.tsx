
'use client';

import Link from 'next/link';
import { RequireAuth } from '@/context/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ForcerChangementMdp } from '@/components/ForcerChangementMdp';

const LIBELLES_ROLE: Record<string, string> = {
  ADMIN: 'Administrateur',
  ENSEIGNANT: 'Enseignant',
  SECRETARIAT: 'Secrétariat',
  COMPTABLE: 'Comptable',
  DIRECTRICE: 'Directrice',
  PARENT: 'Parent',
};

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

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3 print:hidden">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              LC
            </span>
            <span className="font-heading text-base font-semibold">
              Les Colibris
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="flex gap-4 text-sm">
            <Link
              href="/dashboard/eleves"
              className="font-medium hover:text-primary"
            >
              Élèves
            </Link>

            <Link
              href="/dashboard/inscriptions"
              className="font-medium hover:text-primary"
            >
              Inscriptions
            </Link>

            {['ADMIN', 'COMPTABLE', 'DIRECTRICE'].includes(
              utilisateur?.role ?? ''
            ) && (
              <Link
                href="/dashboard/finances/retards"
                className="font-medium hover:text-primary"
              >
                Retards
              </Link>
            )}
            {utilisateur?.role === 'ADMIN' && (
  <Link href="/dashboard/structure" className="font-medium hover:text-primary">Structure</Link>
)}
<Link href="/dashboard/finances/bareme" className="font-medium hover:text-primary">Tarifs</Link>
{utilisateur?.role === 'ADMIN' && (
  <Link href="/dashboard/utilisateurs" className="font-medium hover:text-primary">Utilisateurs</Link>
)}
<Link href="/dashboard/mot-de-passe" className="text-sm hover:text-primary hover:underline">Mon mot de passe</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {utilisateur?.email}
          </span>

          {utilisateur && (
            <Badge variant="secondary">
              {LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}
            </Badge>
          )}

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
