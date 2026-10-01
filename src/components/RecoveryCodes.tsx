import { Button } from '@/components/ui/button';

export default function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const download = () => {
    const blob = new Blob([`EloMondo recovery codes\n\nKeep these offline and private. Each code works once and replaces all existing passkeys.\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'elomondo-recovery-codes.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="space-y-4">
    <h2 className="text-xl font-semibold">Save your recovery codes</h2>
    <p className="text-sm text-muted-foreground">Keep these somewhere private, outside this device. Each code works once if you lose access to your passkeys. Recovery replaces all existing passkeys. These codes are shown only now.</p>
    <div className="space-y-2 rounded-md bg-muted p-3" aria-label="Recovery codes">
      {codes.map(code => <code key={code} className="block break-all text-xs select-all">{code}</code>)}
    </div>
    <Button className="w-full" variant="outline" onClick={download}>Download recovery codes</Button>
    <Button className="w-full" onClick={onDone}>I have saved my codes</Button>
  </div>;
}
