'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'clair' | 'sombre';

function themeEffectif(): Theme {
  try {
    const s = localStorage.getItem('theme');
    if (s === 'clair' || s === 'sombre') return s;
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
}

export function BasculeTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(themeEffectif());
  }, []);

  function basculer() {
    const suivant: Theme = theme === 'sombre' ? 'clair' : 'sombre';
    document.documentElement.classList.toggle('dark', suivant === 'sombre');
    try {
      localStorage.setItem('theme', suivant);
    } catch {}
    setTheme(suivant);
  }

  const sombre = theme === 'sombre';
  const libelle = sombre ? 'Passer au thème clair' : 'Passer au thème sombre';

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={libelle}
      title={libelle}
      className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {theme === null ? null : sombre ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}