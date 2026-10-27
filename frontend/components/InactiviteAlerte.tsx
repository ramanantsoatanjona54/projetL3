'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

const DELAI_MIN = 30; // doit rester égal à INACTIVITE_MIN du backend
const EVENEMENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'] as const;

// Ferme la session après 30 min sans action humaine (l'actualisation automatique ne compte pas),
// avec un avertissement 1 minute avant et la possibilité de prolonger (WCAG 2.2.1)
export function InactiviteAlerte() {
  const { utilisateur, seDeconnecter } = useAuth();
  const [avertissement, setAvertissement] = useState(false);
  const derniere = useRef(0);
  const enAvertissement = useRef(false);
  const actif = !!utilisateur;

  const prolonger = useCallback(async () => {
    try { await api.get('/notifications/non-lues'); } catch { /* si la session est déjà fermée, le minuteur déconnectera */ }
    derniere.current = Date.now();
    enAvertissement.current = false;
    setAvertissement(false);
  }, []);

  useEffect(() => {
    if (!actif) return;
    derniere.current = Date.now();
    const action = () => { if (!enAvertissement.current) derniere.current = Date.now(); };
    EVENEMENTS.forEach((e) => window.addEventListener(e, action, { passive: true }));

    const minuteur = window.setInterval(() => {
      const inactif = Date.now() - derniere.current;
      if (inactif >= DELAI_MIN * 60_000) {
        window.clearInterval(minuteur);
        void seDeconnecter();
      } else if (inactif >= (DELAI_MIN - 1) * 60_000 && !enAvertissement.current) {
        enAvertissement.current = true;
        setAvertissement(true);
      }
    }, 15_000);

    return () => {
      EVENEMENTS.forEach((e) => window.removeEventListener(e, action));
      window.clearInterval(minuteur);
    };
  }, [actif, seDeconnecter]);

  if (!avertissement) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="inact-titre" aria-describedby="inact-texte" className="w-full max-w-sm rounded-lg bg-card p-5 shadow-lg">
        <h2 id="inact-titre" className="mb-2 text-xl font-semibold">Toujours là ?</h2>
        <p id="inact-texte" className="mb-4">Par sécurité, votre session va se fermer dans une minute.</p>
        <div className="flex flex-wrap gap-2">
          <Button autoFocus size="lg" onClick={prolonger}>Rester connecté</Button>
          <Button size="lg" variant="outline" onClick={() => void seDeconnecter()}>Me déconnecter</Button>
        </div>
      </div>
    </div>
  );
}