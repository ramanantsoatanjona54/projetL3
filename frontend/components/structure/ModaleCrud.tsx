'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  ouvert: boolean;
  titre: string;
  description: string;
  libelleValider: string;
  destructif?: boolean;
  enCours: boolean;
  erreur: string | null;
  onFermer: () => void;
  onValider: () => void;
  large?: boolean; // fenêtre plus large pour les formulaires à plusieurs colonnes
  children?: ReactNode;
}

// Structure en trois zones : en-tête fixe, contenu qui défile, pied fixe.
// Les boutons restent donc toujours visibles, quelle que soit la hauteur de l'écran.
export function ModaleCrud({
  ouvert, titre, description, libelleValider, destructif, enCours, erreur, onFermer, onValider, large, children,
}: Props) {
  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!enCours) onValider();
  }
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o && !enCours) onFermer(); }}>
      <DialogContent
        className={`flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 ${large ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <form onSubmit={soumettre} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
            <DialogTitle>{titre}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-2">
            {children}
          </div>

          {erreur && (
            <div className="shrink-0 px-6 pt-3">
              <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>
            </div>
          )}

          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 w-full sm:w-32" onClick={onFermer} disabled={enCours}>
              Retour
            </Button>
            <Button type="submit" variant={destructif ? 'destructive' : 'default'} className="h-11 w-full sm:w-32" disabled={enCours}>
              {enCours ? 'En cours...' : libelleValider}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}