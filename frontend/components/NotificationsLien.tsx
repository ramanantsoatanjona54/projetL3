'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

// Lien « Notifications » de l'en-tête, avec le nombre de messages non lus
export function NotificationsLien() {
  const pathname = usePathname();
  const [nombre, setNombre] = useState(0);

  useEffect(() => {
    let actif = true;
    const charger = () =>
      api.get<{ nombre: number }>('/notifications/non-lues')
        .then((r) => { if (actif) setNombre(r.nombre); })
        .catch(() => {});
    charger();
    const t = setInterval(charger, 60_000);
    return () => { actif = false; clearInterval(t); };
  }, [pathname]);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={nombre > 0 ? `Notifications, ${nombre} non lue(s)` : 'Notifications'}
      className="flex items-center gap-1.5 text-sm hover:text-primary hover:underline"
    >
      Notifications
      {nombre > 0 && <Badge>{nombre}</Badge>}
    </Link>
  );
}