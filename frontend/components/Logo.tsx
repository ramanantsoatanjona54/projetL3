import Image from 'next/image';

type Props = {
  taille?: number;       // largeur et hauteur en px (le logo est rond, donc carré)
  decoratif?: boolean;   // true quand « Les Colibris » est écrit à côté
  priorite?: boolean;    // true sur la page de connexion
};

export function Logo({ taille = 36, decoratif = false, priorite = false }: Props) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-white"
      style={{ width: taille, height: taille }}
    >
      <Image
        src="/logo.png"
        alt={decoratif ? '' : 'Les Colibris'}
        fill
        sizes={`${taille}px`}
        priority={priorite}
        className="object-cover"
      />
    </span>
  );
}