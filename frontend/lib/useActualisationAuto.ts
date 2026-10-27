'use client';

import { useEffect } from 'react';

// Recharge toutes les X secondes, et dès que l'onglet redevient visible
export function useActualisationAuto(charger: () => void, intervalleMs = 10000) {
  useEffect(() => {
    const actualiser = () => {
      if (document.visibilityState === 'visible') charger();
    };
    const id = setInterval(actualiser, intervalleMs);
    document.addEventListener('visibilitychange', actualiser);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', actualiser);
    };
  }, [charger, intervalleMs]);
}