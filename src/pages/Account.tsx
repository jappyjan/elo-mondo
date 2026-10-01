import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { useAuth } from '@/contexts/AuthContext';
import { usePasskeys, passkeyError } from '@/hooks/usePasskeys';
import { convex, api } from '@/integrations/convex/client';
import type { Id } from '../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RecoveryCodes from '@/components/RecoveryCodes';
import { Loader2, Fingerprint } from 'lucide-react';

function PasskeyRow({ credential, disabled, rename, remove }: {
  credential: { id: Id<'passkeys'>; name: string; createdAt: number; lastUsedAt?: number };
  disabled: boolean; rename: (id: Id<'passkeys'>, name: string) => void; remove: (id: Id<'passkeys'>) => void;
}) {
  const [name, setName] = useState(credential.name);
  return <div className="space-y-3 rounded-md border p-4">
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); rename(credential.id, name); }}>
      <Input className="min-w-0 flex-1" aria-label="Passkey name" value={name} maxLength={100} onChange={event => setName(event.target.value)} disabled={disabled} required />
      <Button variant="outline" disabled={disabled || name.trim() === credential.name} type="submit">Rename</Button>
      <Button variant="outline" disabled={disabled} type="button" onClick={() => remove(credential.id)}>Remove</Button>
    </form>
    <p className="text-xs text-muted-foreground">Added {new Date(credential.createdAt).toLocaleDateString()}{credential.lastUsedAt ? ` · Last used ${new Date(credential.lastUsedAt).toLocaleDateString()}` : ''}</p>
  </div>;
}

export default function Account() {
  const { user, loading } = useAuth();
  const passkeys = usePasskeys();
  const credentials = useQuery(api.passkeyStore.list, user ? {} : 'skip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const secureAction = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await passkeys.authenticate(); await operation(); }
    catch (err) { setError(passkeyError(err)); }
    finally { setBusy(false); }
  };
  // Reauthentication rotates the server session before its replacement token reaches
  // the browser. Keep this screen mounted through that brief unauthenticated state.
  if (loading || (!user && busy)) return <Loader2 aria-label="Verifying passkey" className="mx-auto mt-16 h-8 w-8 animate-spin" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
    <Link to="/groups" className="text-sm text-muted-foreground">← My groups</Link>
    <h1 className="text-3xl font-bold">Account security</h1>
    <p className="text-muted-foreground">{user.name ?? 'Your account'} · Verify an existing passkey before making changes.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Follow your browser's passkey prompt.</p>}
    <Card><CardHeader><CardTitle>Passkeys</CardTitle><CardDescription>Add a second passkey or hardware security key so you can still sign in if you lose a device.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {credentials === undefined ? <Loader2 className="h-6 w-6 animate-spin" /> : credentials.map(credential => <PasskeyRow key={credential.id} credential={credential} disabled={busy || !!codes.length}
          rename={(id, name) => void secureAction(async () => { await convex.mutation(api.passkeyStore.rename, { id, name }); })}
          remove={id => {
            if (credentials.length === 1) { setError('Add another passkey before removing your last one.'); return; }
            void secureAction(async () => { await convex.mutation(api.passkeyStore.remove, { id }); });
          }} />)}
        <Button disabled={busy || !!codes.length} onClick={() => void secureAction(async () => {
          await passkeys.finish(await convex.action(api.passkeys.begin, { purpose: 'add' }));
        })}><Fingerprint className="h-4 w-4 mr-2" />Add a passkey</Button>
        <p className="text-xs text-muted-foreground">Removing a passkey signs out sessions that used it. You must keep at least one passkey.</p>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Recovery codes</CardTitle><CardDescription>Keep a copy offline. Generating new codes invalidates all previous recovery codes.</CardDescription></CardHeader>
      <CardContent>{codes.length ? <RecoveryCodes codes={codes} onDone={() => setCodes([])} /> : <Button variant="outline" disabled={busy} onClick={() => void secureAction(async () => {
        setCodes(await convex.action(api.passkeys.recoveryCodes, {}));
      })}>Generate new recovery codes</Button>}</CardContent>
    </Card>
  </div>;
}
