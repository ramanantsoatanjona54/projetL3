'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Etat { actif: boolean; obligatoire: boolean; codesRestants: number }
interface Preparation { secret: string; otpauthUrl: string }

export default function PageSecurite() {
  const { utilisateur, mettreAJourUtilisateur } = useAuth();
  const router = useRouter();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [prep, setPrep] = useState<Preparation | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [note, setNote] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [modale, setModale] = useState<'desactiver' | 'regenerer' | null>(null);
  const [mdp, setMdp] = useState('');
  const [codeModale, setCodeModale] = useState('');
  const [erreurModale, setErreurModale] = useState<string | null>(null);

  const charger = useCallback(() => {
    api.get<Etat>('/auth/2fa/etat').then(setEtat).catch((e) => setErreur(messageErreur(e)));
  }, []);
  useEffect(() => { if (utilisateur) charger(); }, [utilisateur, charger]);
  useEffect(() => {
    if (prep) QRCode.toDataURL(prep.otpauthUrl, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(''));
  }, [prep]);

  async function preparer() {
    setEnCours(true); setErreur(null);
    try { setPrep(await api.post<Preparation>('/auth/2fa/preparer', {})); setCode(''); } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  async function activer() {
    setEnCours(true); setErreur(null);
    try {
      const r = await api.post<{ codesSecours: string[] }>('/auth/2fa/activer', { code });
      setCodes(r.codesSecours); setPrep(null); setQr(''); charger();
    } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  async function confirmerModale() {
    setEnCours(true); setErreurModale(null);
    try {
      if (modale === 'desactiver') {
        await api.post('/auth/2fa/desactiver', { motDePasse: mdp, code: codeModale });
        setInfo('Double authentification désactivée.');
      } else {
        const r = await api.post<{ codesSecours: string[] }>('/auth/2fa/codes-secours', { motDePasse: mdp, code: codeModale });
        setCodes(r.codesSecours); setNote(false);
      }
      setModale(null); setMdp(''); setCodeModale(''); charger();
    } catch (e) { setErreurModale(messageErreur(e)); } finally { setEnCours(false); }
  }

  async function copier() {
    try { await navigator.clipboard.writeText((codes ?? []).join('\n')); setInfo('Codes copiés dans le presse-papiers.'); }
    catch { setInfo('Copie impossible : recopiez les codes à la main.'); }
  }

  function terminer() {
    mettreAJourUtilisateur({ doitActiver2fa: false });
    setCodes(null);
    router.push('/dashboard');
  }

  if (!utilisateur) return null;
  if (!etat) return erreur ? <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert> : <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-3xl font-semibold">Sécurité du compte</h1>
      <p className="mb-6 text-sm text-muted-foreground">Double authentification : un code temporaire de votre téléphone en plus du mot de passe.</p>

      {utilisateur.doitActiver2fa && (
        <Alert role="status" className="mb-4"><AlertDescription>La double authentification est obligatoire pour les administrateurs. Activez-la pour continuer.</AlertDescription></Alert>
      )}
      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      {codes ? (
        <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="codes-t">
          <h2 id="codes-t" className="mb-1 text-xl font-semibold">Vos codes de secours</h2>
          <p className="mb-3 text-sm">Chaque code ne sert qu&apos;une fois, si vous perdez votre téléphone. <strong>Ils ne seront plus jamais affichés.</strong> Conservez-les hors de l&apos;ordinateur (papier, coffre).</p>
          <ul className="mb-3 grid grid-cols-2 gap-2 font-mono text-lg">{codes.map((c) => <li key={c} className="rounded border border-border px-2 py-1 text-center">{c}</li>)}</ul>
          <div className="mb-3 flex flex-wrap gap-2"><Button variant="outline" onClick={copier}>Copier les codes</Button></div>
          <label className="mb-3 flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-primary" checked={note} onChange={(e) => setNote(e.target.checked)} />
            J&apos;ai conservé ces codes en lieu sûr
          </label>
          <Button size="lg" onClick={terminer} disabled={!note}>Terminer</Button>
        </section>
      ) : etat.actif ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 flex flex-wrap items-center gap-2"><Badge>Activée</Badge> <span className="text-sm">{etat.codesRestants} code(s) de secours restant(s)</span></p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setErreurModale(null); setModale('regenerer'); }}>Générer de nouveaux codes de secours</Button>
            {!etat.obligatoire && <Button variant="outline" onClick={() => { setErreurModale(null); setModale('desactiver'); }}>Désactiver</Button>}
          </div>
          {etat.obligatoire && <p className="mt-3 text-sm text-muted-foreground">Obligatoire pour les administrateurs : elle ne peut pas être désactivée.</p>}
        </section>
      ) : !prep ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2"><Badge variant="secondary">Non activée</Badge></p>
          <p className="mb-3 text-sm">Il vous faut une application d&apos;authentification gratuite sur votre téléphone (Google Authenticator, FreeOTP, Aegis...).</p>
          <Button size="lg" onClick={preparer} disabled={enCours}>Activer la double authentification</Button>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="etapes-t">
          <h2 id="etapes-t" className="mb-3 text-xl font-semibold">Configuration</h2>
          <ol className="list-decimal space-y-4 pl-5">
            <li>
              Scannez ce code QR avec votre application.
              {qr && <img src={qr} alt="Code QR à scanner avec votre application d'authentification" width={220} height={220} className="mt-2 rounded border border-border bg-white" />}
              <p className="mt-2 text-sm">Pas de caméra ? Saisissez cette clé dans l&apos;application :</p>
              <p className="mt-1 break-all rounded bg-muted px-2 py-1 font-mono text-base">{prep.secret.match(/.{1,4}/g)?.join(' ')}</p>
            </li>
            <li>
              <Label htmlFor="code-act">Saisissez le code à 6 chiffres affiché</Label>
              <Input id="code-act" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="mt-1.5 h-12 w-44 text-lg tracking-widest" />
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" onClick={activer} disabled={enCours || code.trim().length < 6}>{enCours ? 'Vérification...' : 'Activer'}</Button>
            <Button size="lg" variant="outline" onClick={() => { setPrep(null); setQr(''); }} disabled={enCours}>Annuler</Button>
          </div>
        </section>
      )}

      <ModaleCrud
        ouvert={modale !== null}
        titre={modale === 'desactiver' ? 'Désactiver la double authentification' : 'Nouveaux codes de secours'}
        description="Confirmez avec votre mot de passe et un code de votre application."
        libelleValider={modale === 'desactiver' ? 'Désactiver' : 'Générer'}
        destructif={modale === 'desactiver'} enCours={enCours} erreur={erreurModale}
        onFermer={() => setModale(null)} onValider={confirmerModale}
      >
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="m-mdp">Mot de passe</Label><Input id="m-mdp" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} className="h-11" /></div>
          <div className="space-y-1.5"><Label htmlFor="m-code">Code à 6 chiffres</Label><Input id="m-code" value={codeModale} onChange={(e) => setCodeModale(e.target.value)} autoComplete="one-time-code" maxLength={14} className="h-11 w-44" /></div>
        </div>
      </ModaleCrud>
    </div>
  );
}