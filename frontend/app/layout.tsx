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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
  <html lang="fr" className={`${fraunces.variable} ${publicSans.variable}`}>
    <body className="antialiased">
      <AuthProvider>{children}</AuthProvider>
    </body>
  </html>
);
}