'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateHeure } from '@/lib/audit';
import type { MesNotifications } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActualisationAuto } from '@/lib/useActualisationAuto';

export default function Notifications() {
  const [d, setD] = useState<MesNotifications | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    api.get<MesNotifications>('/notifications').then((r) => { setD(r); setErreur(null); }).catch((e) => setErreur(messageErreur(e)));
  }, []);
  useEffect(() => { charger(); }, [charger]);
   useActualisationAuto(charger, 15000);

  async function lire(id: number) {
    try { await api.patch(`/notifications/${id}/lu`, {}); charger(); } catch (e) { setErreur(messageErreur(e)); }
  }
  async function toutLire() {
    try { await api.patch('/notifications/tout-lire', {}); charger(); } catch (e) { setErreur(messageErreur(e)); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {d ? (d.nonLues > 0 ? `${d.nonLues} non lue(s)` : 'Tout est lu') : 'Chargement...'}
          </p>
        </div>
        {d && d.nonLues > 0 && <Button variant="outline" onClick={toutLire}>Tout marquer comme lu</Button>}
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {d && d.notifications.length === 0 && <li className="px-4 py-10 text-center text-muted-foreground">Aucune notification.</li>}
        {d?.notifications.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className={n.lu ? 'text-muted-foreground' : 'font-medium'}>
                {!n.lu && <Badge className="mr-2">Nouveau</Badge>}{n.message}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">{dateHeure(n.date)}</p>
            </div>
            {!n.lu && <Button size="sm" variant="outline" onClick={() => lire(n.id)} aria-label={`Marquer comme lue : ${n.message}`}>Marquer comme lu</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}