import { NextRequest, NextResponse } from 'next/server';

// Sans cookie de session, le tableau de bord n'est même pas servi : retour direct à la connexion.
// (La vraie protection reste l'API, qui revérifie la session à chaque requête.)
export function proxy(req: NextRequest) {
  if (!req.cookies.get('session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };