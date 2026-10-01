import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

type Step = 'signIn' | 'signUp' | 'reset' | 'reset-verification' | 'email-verification';
export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => { if (user) navigate('/groups', { replace: true }); }, [user, navigate]);

  const changeStep = (next: Step) => { setStep(next); setPassword(''); setCode(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await signIn('password', {
        flow: step, email: email.trim().toLowerCase(),
        ...(step === 'signIn' || step === 'signUp' ? { password } : {}),
        ...(step === 'signUp' ? { name: name.trim() } : {}),
        ...(step === 'reset-verification' ? { newPassword: password } : {}),
        ...(step === 'reset-verification' || step === 'email-verification' ? { code: code.trim().toUpperCase() } : {}),
      });
      if (step === 'reset') {
        changeStep('reset-verification');
        toast({ title: 'Check your email', description: 'Enter your reset code and choose a new password.' });
      } else if (!result.signingIn && (step === 'signUp' || step === 'signIn')) {
        changeStep('email-verification');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast({
        title: 'Unable to continue',
        description: step === 'signIn' ? 'Check your email and password. Existing DIGIMONDO players need to set a new password first.'
          : step === 'signUp' ? 'Unable to create an account. If you already have one, use Set a new password.'
          : step === 'reset' ? 'Unable to send a reset code. Check the address and try again.'
          : 'The code could not be verified. Check it or request a new code.',
        variant: 'destructive',
      });
      if (import.meta.env.DEV) console.error('Authentication failed:', message);
    } finally { setIsLoading(false); }
  };
  if (loading || user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  const verifying = step === 'reset-verification' || step === 'email-verification';
  const needsPassword = step === 'signIn' || step === 'signUp' || step === 'reset-verification';
  const title = step === 'signUp' ? 'Create account' : step === 'reset' ? 'Set a new password' : step === 'reset-verification' ? 'Reset password' : step === 'email-verification' ? 'Verify email' : 'Login';
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Target className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">EloMondo</CardTitle>
          <CardDescription>{title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'signIn' && <p className="text-sm text-muted-foreground">Already a DIGIMONDO player? Set a new password to keep your match history.</p>}
          {verifying && <p className="text-sm text-muted-foreground">Enter the code sent to {email}. The code expires after 15 minutes.</p>}
          <form onSubmit={submit} className="space-y-4">
            {step === 'signUp' && <div className="space-y-2"><Label htmlFor="auth-name">Display name</Label><Input id="auth-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={100} required autoComplete="nickname" /></div>}
            {!verifying && <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>}
            {verifying && <div className="space-y-2"><Label htmlFor="auth-code">Email code</Label><Input id="auth-code" value={code} onChange={e => setCode(e.target.value)} required autoComplete="one-time-code" /></div>}
            {needsPassword && <div className="space-y-2"><Label htmlFor="auth-password">{step === 'reset-verification' ? 'New password' : 'Password'}</Label><Input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required autoComplete={step === 'signIn' ? 'current-password' : 'new-password'} /></div>}
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{step === 'reset' ? 'Send reset code' : verifying ? 'Continue' : title}</Button>
          </form>
          {step === 'signIn' && <div className="flex flex-col gap-2"><Button variant="outline" onClick={() => changeStep('reset')}>Set a new password</Button><Button variant="ghost" onClick={() => changeStep('signUp')}>Create an account</Button></div>}
          {step !== 'signIn' && <Button variant="ghost" className="w-full" disabled={isLoading} onClick={() => changeStep(verifying ? (step === 'reset-verification' ? 'reset' : 'signIn') : 'signIn')}>{verifying ? 'Back / request a new code' : 'Back to login'}</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
