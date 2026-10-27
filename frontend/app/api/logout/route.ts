import { NextRequest, NextResponse } from 'next/server';
import { origineValide } from '@/lib/csrf';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001/api';

export async function POST(req: NextRequest) {
  if (!origineValide(req)) return NextResponse.json({ message: 'Origine non autorisée' }, { status: 403 });
  const token = req.cookies.get('session')?.value;
  if (token) {
    // La session est révoquée côté serveur ; si l'API est injoignable, le cookie est tout de même supprimé
    try { await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch {}
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('session');
  return response;
}