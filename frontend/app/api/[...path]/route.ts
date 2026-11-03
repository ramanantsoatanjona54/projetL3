import { NextRequest, NextResponse } from 'next/server';
import { ipClient, origineValide } from '@/lib/csrf';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001/api';

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (segments.some((s) => s === '.' || s === '..' || s.includes('\\'))) {
    return NextResponse.json({ message: 'Chemin invalide' }, { status: 400 });
  }
  if (!['GET', 'HEAD'].includes(req.method) && !origineValide(req)) {
    return NextResponse.json({ message: 'Origine non autorisée' }, { status: 403 });
  }

  const token = req.cookies.get('session')?.value;
  const ip = ipClient(req);
  const url = `${BACKEND_URL}/${segments.join('/')}${req.nextUrl.search}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(ip ? { 'X-Forwarded-For': ip } : {}),
      },
      body,
    });
  } catch {
    return NextResponse.json({ message: 'Service momentanément indisponible' }, { status: 502 });
  }

  // Octets bruts : indispensable pour les fichiers (Word, PDF...), sans effet sur le JSON
  const octets = await res.arrayBuffer();
  const entetes: Record<string, string> = {
    'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
    'Cache-Control': 'no-store',
  };
  const disposition = res.headers.get('Content-Disposition');
  if (disposition) entetes['Content-Disposition'] = disposition;

  const reponse = new NextResponse(octets, { status: res.status, headers: entetes });
  if (res.status === 401 && token) reponse.cookies.delete('session'); // session expirée : le cookie ne sert plus
  return reponse;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE, proxy as PUT };