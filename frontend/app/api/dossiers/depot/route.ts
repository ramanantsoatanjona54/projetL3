import { cookies } from 'next/headers';
import { NextResponse , NextRequest } from 'next/server';
import { origineValide } from '@/lib/csrf';


// ⚠ À aligner sur la variable utilisée dans app/api/[...path]/route.ts
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001/api';

export async function POST(req: NextRequest) {
  if (!origineValide(req)) return NextResponse.json({ message: 'Origine non autorisée' }, { status: 403 });
  const token = (await cookies()).get('session')?.value;
  if (!token) return NextResponse.json({ message: 'Session expirée. Reconnectez-vous.' }, { status: 401 });

  let entree: FormData;
  try {
    entree = await req.formData();
  } catch {
    return NextResponse.json({ message: 'Envoi invalide.' }, { status: 400 });
  }
  const sortie = new FormData();
  for (const [cle, valeur] of entree.entries()) sortie.append(cle, valeur);

  const r = await fetch(`${BACKEND}/dossiers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: sortie,
    cache: 'no-store',
  });
  const texte = await r.text();
  return new NextResponse(texte, {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' },
  });
}