const FUSEAU = 'Indian/Antananarivo'; // UTC+3, comme le serveur

export const aujourdhuiIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date());
export const moisCourant = () => aujourdhuiIso().slice(0, 7);

export function heureLocale(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSEAU });
}

// jour 'AAAA-MM-JJ' + heure 'HH:mm' -> instant ISO à l'heure de Madagascar
export const versIso = (jour: string, heure: string) => `${jour}T${heure}:00+03:00`;

export function duree(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function decalerJour(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function libelleJour(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}