// Traduit les messages techniques de class-validator (NestJS) en phrases françaises par champ
const MOTIFS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/must be a valid ISO 8601 date string/i, () => 'doit être une date valide'],
  [/must be an email/i, () => 'doit être une adresse email valide'],
  [/should not be empty/i, () => 'est obligatoire'],
  [/must be shorter than or equal to (\d+) characters/i, (m) => `est trop long (${m[1]} caractères maximum)`],
  [/must be longer than or equal to (\d+) characters/i, (m) => `est trop court (${m[1]} caractères minimum)`],
  [/must be a number/i, () => 'doit être un nombre'],
  [/must be one of the following values/i, () => 'a une valeur non autorisée'],
];

export function traduireErreursServeur(message: string, libelles: Record<string, string>) {
  const champs: Record<string, string> = {};
  const generales: string[] = [];

  for (const part of message.split(', ')) {
    const cle = part.split(' ')[0];
    if (cle in libelles) {
      const motif = MOTIFS.find(([re]) => re.test(part));
      const texte = motif ? motif[1](part.match(motif[0])!) : 'est invalide';
      champs[cle] = `${libelles[cle]} ${texte}.`;
    } else {
      generales.push(part);
    }
  }
  return { champs, generale: generales.length ? generales.join(', ') : null };
}