import type { Metadata } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Gestion scolaire',
  description: "Application de gestion pour l'établissement",
};

// Applique le thème AVANT l'affichage, pour éviter l'éclair blanc (texte fixe, aucune donnée utilisateur)
const SCRIPT_THEME = `(function(){try{var t=localStorage.getItem('theme');var s=t==='sombre'||(t!=='clair'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(s){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${publicSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}