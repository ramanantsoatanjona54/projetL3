import Image from 'next/image';

type Props = {
  taille?: number;       // largeur et hauteur en px (le logo est rond, donc carré)
  decoratif?: boolean;   // true quand « Les Colibris » est écrit à côté
  priorite?: boolean;    // true sur la page de connexion
};

export function Logo({ taille = 36, decoratif = false, priorite = false }: Props) {
  return (
    <Image
      src="/logo.png"
      alt={decoratif ? '' : 'Les Colibris'}
      width={taille}
      height={taille}
      priority={priorite}
      style={{ width: taille, height: taille }}
      className="shrink-0 rounded-full bg-white object-cover"
    />
  );
}