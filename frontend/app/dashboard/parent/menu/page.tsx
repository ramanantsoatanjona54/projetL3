'use client';

import Link from 'next/link';
import { MenuSemaine } from '@/components/menu/MenuSemaine';

export default function MenuParent() {
  return (
    <div>
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Menu de la cantine</h1>
      <p className="mb-6 text-sm text-muted-foreground">Menu de la semaine, du lundi au vendredi.</p>
      <MenuSemaine peutModifier={false} />
    </div>
  );
}