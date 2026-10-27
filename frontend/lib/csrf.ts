import type { NextRequest } from 'next/server';

// Défense CSRF : une écriture doit venir de notre propre site
export function origineValide(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (!origin) return true; // requête qui ne vient pas d'un navigateur
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

// Adresse du client, posée par Nginx (en production) pour le limiteur de l'API
export function ipClient(req: NextRequest): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
}