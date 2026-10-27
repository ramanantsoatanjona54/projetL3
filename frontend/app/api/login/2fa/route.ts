import { NextRequest, NextResponse } from 'next/server';
import { ipClient, origineValide } from '@/lib/csrf';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001/api';

export async function POST(req: NextRequest) {
  if (!origineValide(req)) return NextResponse.json({ message: 'Origine non autorisée' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ message: 'Requête invalide' }, { status: 400 });

  const ip = ipClient(req);
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/login/2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': req.headers.get('user-agent') ?? '', ...(ip ? { 'X-Forwarded-For': ip } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ message: 'Service momentanément indisponible' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({ message: 'Réponse invalide du serveur' }));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  const response = NextResponse.json({ utilisateur: data.utilisateur });
  response.cookies.set('session', data.access_token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    maxAge: data.expireDans ?? 60 * 60 * 8,
  });
  return response;
}