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
  children?: ReactNode;
}

export function ModaleCrud({
  ouvert, titre, description, libelleValider, destructif, enCours, erreur, onFermer, onValider, children,
}: Props) {
  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!enCours) onValider();
  }
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o && !enCours) onFermer(); }}>
      <DialogContent>
        <form onSubmit={soumettre} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {erreur && (
            <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>Retour</Button>
            <Button type="submit" variant={destructif ? 'destructive' : 'default'} disabled={enCours}>
              {enCours ? 'En cours...' : libelleValider}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}