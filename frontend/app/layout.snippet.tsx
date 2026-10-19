// Ceci N'EST PAS un fichier à copier tel quel : c'est un extrait montrant
// comment adapter ton app/layout.tsx existant (généré par create-next-app)
// pour y ajouter AuthProvider. Reporte-toi à INTEGRATION_FRONTEND.md.

import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'Les Colibris — Gestion scolaire',
  description: 'Plateforme de gestion scolaire École Les Colibris',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
