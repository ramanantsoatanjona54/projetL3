'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold">Tableau de bord</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Bienvenue. Les modules disponibles dépendent de votre rôle.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            Finances, pédagogie, RH et vie scolaire viendront se brancher ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Le module Élèves est disponible dans la barre de navigation.
        </CardContent>
      </Card>
    </div>
  );
}