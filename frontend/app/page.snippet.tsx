// Extrait pour app/page.tsx (page d'accueil "/") : redirige directement vers /login.
// Remplace le contenu par défaut généré par create-next-app.

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
