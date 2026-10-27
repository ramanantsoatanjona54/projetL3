import Image from 'next/image';
import type { ReactNode } from 'react';

// Grand code en Fraunces, couleur bordeaux : le design reste celui de l'école, sans illustration générique
export function EtatPage({ code, titre, children, actions }: { code: string; titre: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-12">
      <Image src="/logo.png" alt="" width={56} height={56} className="mb-6 h-14 w-auto" />
      <p aria-hidden="true" className="font-heading text-8xl font-semibold leading-none text-primary">{code}</p>
      <h1 className="mt-4 text-3xl font-semibold">{titre}</h1>
      <div className="mt-2 text-lg text-muted-foreground">{children}</div>
      <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
    </main>
  );
}

export const LIEN_PRINCIPAL =
  'inline-flex h-11 items-center rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';