'use client';

import { useRouter } from 'next/navigation';
import { FormulaireEleve } from '@/components/eleves/FormulaireEleve';

export default function NouvelEleve() {
  const router = useRouter();
  return <FormulaireEleve mode="creation" onSuccess={() => router.push('/dashboard/eleves')} />;
}