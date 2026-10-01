import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { browserSupportsWebAuthn } from '@elomondo/webauthn-browser';
import { useAuth } from '@/contexts/AuthContext';
import { usePasskeys, passkeyError } from '@/hooks/usePasskeys';
import { convex, api } from '@/integrations/convex/client';
import type { BeginResult } from '../../convex/passkeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RecoveryCodes from '@/components/RecoveryCodes';
import { Target, Loader2, Fingerprint } from 'lucide-react';

type Step = 'authenticate' | 'signup' | 'claim' | 'recover';
export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const passkeys = usePasskeys();
  const [step, setStep] = useState<Step>('authenticate');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<BeginResult | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  useEffect(() => { if (user && !busy && !prepared && !recoveryCodes.length) navigate('/groups', { replace: true }); }, [user, busy, prepared, recoveryCodes.length, navigate]);
  const supported = browserSupportsWebAuthn();
  const changeStep = (next: Step) => { setStep(next); setCode(''); setError(''); setPrepared(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (prepared) {
        const codes = await passkeys.finish(prepared);
        setRecoveryCodes(codes); setPrepared(null); setCode('');
      } else if (step === 'authenticate') {
        await passkeys.authenticate();
      } else {
        setPrepared(await convex.action(api.passkeys.begin, { purpose: step, ...(step === 'signup' ? { name: name.trim() } : { code: code.trim() }) }));
      }
    } catch (err) { setError(passkeyError(err)); setPrepared(null); }
    finally { setBusy(false); }
  };
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  const title = prepared ? `Create a passkey for ${prepared.name}` : step === 'signup' ? 'Create account' : step === 'claim' ? 'Claim your existing player' : step === 'recover' ? 'Recover your account' : 'Sign in';
  return <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link to="/" aria-label="EloMondo home"><Target className="h-12 w-12 text-primary mx-auto mb-4" /></Link>
        <CardTitle className="text-2xl">EloMondo</CardTitle><CardDescription>{recoveryCodes.length ? 'Your passkey is ready' : title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recoveryCodes.length ? <RecoveryCodes codes={recoveryCodes} onDone={() => { setRecoveryCodes([]); navigate('/groups', { replace: true }); }} /> : <>
          {!supported && <p role="alert" className="text-sm text-destructive">Passkeys need a supported browser and a secure connection. Open EloMondo in an up-to-date browser.</p>}
          {step === 'authenticate' && !prepared && <p className="text-sm text-muted-foreground">Use your phone, password manager, or security key to sign in.</p>}
          {step === 'claim' && <p className="text-sm text-muted-foreground">Ask the EloMondo owner for your personal claim code. This keeps your groups, roles, and match history.</p>}
          {step === 'recover' && <p className="text-sm text-muted-foreground">Use one of your saved recovery codes. This will replace all existing passkeys and sign out other devices. If you have another passkey, sign in with that instead.</p>}
          {prepared && <p className="text-sm text-muted-foreground">Confirm this is your player, then save a passkey on your device or security key.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            {!prepared && step === 'signup' && <div className="space-y-2"><Label htmlFor="auth-name">Display name</Label><Input id="auth-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={100} required autoComplete="nickname" disabled={busy} /></div>}
            {!prepared && (step === 'claim' || step === 'recover') && <div className="space-y-2"><Label htmlFor="auth-code">{step === 'claim' ? 'Personal claim code' : 'Recovery code'}</Label><Input id="auth-code" value={code} onChange={e => setCode(e.target.value)} required maxLength={100} autoComplete="off" spellCheck={false} autoCapitalize="none" disabled={busy} /></div>}
            <Button type="submit" className="w-full" disabled={busy || !supported}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Fingerprint className="h-4 w-4 mr-2" />}{prepared ? 'Create passkey' : step === 'authenticate' ? 'Sign in with passkey' : 'Continue'}</Button>
          </form>
          {!prepared && step === 'authenticate' && <div className="flex flex-col gap-2"><Button variant="outline" disabled={busy} onClick={() => changeStep('signup')}>Create an account</Button><Button variant="ghost" disabled={busy} onClick={() => changeStep('claim')}>Already a player? Claim your account</Button><Button variant="ghost" disabled={busy} onClick={() => changeStep('recover')}>Lost access to your passkeys?</Button></div>}
          {(prepared || step !== 'authenticate') && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => changeStep('authenticate')}>Back to sign in</Button>}
        </>}
      </CardContent>
    </Card>
  </div>;
}
