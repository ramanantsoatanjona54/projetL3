import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ⚠ À aligner sur la variable utilisée dans app/api/[...path]/route.ts
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001/api';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'Identifiant invalide.' }, { status: 400 });

  const token = (await cookies()).get('session')?.value;
  if (!token) return NextResponse.json({ message: 'Session expirée. Reconnectez-vous.' }, { status: 401 });

  const r = await fetch(`${BACKEND}/dossiers/${id}/fichier`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!r.ok) {
    const texte = await r.text();
    return new NextResponse(texte, {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' },
    });
  }

  const h = new Headers();
  for (const k of ['content-type', 'content-disposition', 'content-length', 'x-content-type-options']) {
    const v = r.headers.get(k);
    if (v) h.set(k, v);
  }
  h.set('Cache-Control', 'private, no-store');
  return new NextResponse(r.body, { status: 200, headers: h });
}