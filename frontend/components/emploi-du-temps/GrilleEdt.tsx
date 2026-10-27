'use client';

import type { CreneauEdt } from '@/lib/types';
import { Button } from '@/components/ui/button';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

interface Props {
  creneaux: CreneauEdt[];
  onModifier?: (c: CreneauEdt) => void;
  onSupprimer?: (c: CreneauEdt) => void;
}

export function GrilleEdt({ creneaux, onModifier, onSupprimer }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {JOURS.map((jour, i) => {
        const duJour = creneaux.filter((c) => c.jourSemaine === i + 1);
        return (
          <section key={jour} aria-labelledby={`edt-jour-${i}`} className="rounded-lg border border-border bg-card p-3">
            <h2 id={`edt-jour-${i}`} className="mb-3 font-semibold">{jour}</h2>
            {duJour.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun cours.</p>
            ) : (
              <ul className="space-y-2">
                {duJour.map((c) => (
                  <li key={c.id} className="rounded-md border border-border p-2">
                    <p className="text-sm tabular-nums text-muted-foreground">{c.heureDebut} – {c.heureFin}</p>
                    <p className="font-medium">{c.matiere?.nom ?? c.titre}</p>
                    {c.matiere && c.titre && <p className="text-sm">{c.titre}</p>}
                    {c.enseignant && <p className="text-sm text-muted-foreground">{c.enseignant.prenom} {c.enseignant.nom}</p>}
                    {(onModifier || onSupprimer) && (
                      <div className="mt-2 flex gap-2">
                        {onModifier && (
                          <Button size="sm" variant="outline" onClick={() => onModifier(c)}
                            aria-label={`Modifier ${jour} ${c.heureDebut} ${c.matiere?.nom ?? c.titre}`}>Modifier</Button>
                        )}
                        {onSupprimer && (
                          <Button size="sm" variant="ghost" onClick={() => onSupprimer(c)}
                            aria-label={`Supprimer ${jour} ${c.heureDebut} ${c.matiere?.nom ?? c.titre}`}>Supprimer</Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}