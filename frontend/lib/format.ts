export const ar = (v: unknown) => `${new Intl.NumberFormat('fr-FR').format(Number(v))} Ar`;
export const dateFr = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
export const nomMois = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));