import Link from 'next/link';
import { EtatPage, LIEN_PRINCIPAL } from '@/components/EtatPage';

export default function NonTrouvee() {
  return (
    <EtatPage code="404" titre="Page introuvable" actions={<Link href="/dashboard" className={LIEN_PRINCIPAL}>Retour à l&apos;accueil</Link>}>
      <p>Cette page n&apos;existe pas ou a été déplacée. Vérifiez l&apos;adresse, ou repartez de l&apos;accueil.</p>
    </EtatPage>
  );
}