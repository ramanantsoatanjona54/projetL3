import Link from 'next/link';
import { FormulairePersonnel } from '@/components/personnel/FormulairePersonnel';

export default function NouveauPersonnel() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/personnel" className="text-sm text-muted-foreground hover:underline">&larr; Retour au personnel</Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold">Nouvelle fiche du personnel</h1>
      <FormulairePersonnel />
    </div>
  );
}