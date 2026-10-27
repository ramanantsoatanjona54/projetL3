import { notFound } from 'next/navigation';

// Toute adresse inconnue sous /dashboard déclenche la page 404 du tableau de bord (menu conservé)
export default function Introuvable() {
  notFound();
}