#!/usr/bin/env node
// Never print claim secrets or put them in command-line arguments.
import { execFileSync } from 'node:child_process';
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/auth/prepare-claims.mjs [--prod] [--output=claims.local] [--review-activated=LEGACY_UUID]');
  process.exit(0);
}
if (args.some(arg => arg !== '--prod' && !arg.startsWith('--output=') && !arg.startsWith('--review-activated='))) throw new Error('Unknown argument; use --help');
const production = args.includes('--prod');
const output = resolve(args.find(arg => arg.startsWith('--output='))?.slice('--output='.length) ?? '.passkey-claims.local');
if (!output.endsWith('.local')) throw new Error('Use a .local output file so claim secrets remain gitignored');
const reviewed = new Set(args.filter(arg => arg.startsWith('--review-activated=')).map(arg => arg.slice('--review-activated='.length)));
const run = (fn, params) => {
  try {
    return JSON.parse(execFileSync('npx', ['convex', 'run', ...(production ? ['--prod'] : []), fn, JSON.stringify(params)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    // execFileSync errors can contain stdout, including an issued claim code.
    throw new Error(`Convex administration failed for ${fn}; private command output was suppressed`);
  }
};
const accounts = run('passkeyStore:auditLegacy', {});
const pending = accounts.filter(account => !account.disabled && !account.migrated);
for (const account of pending) {
  if (!account.legacyId) throw new Error('An unmigrated non-legacy account needs an operator review');
  if ((account.hasPassword || account.hasSessions || account.isAdmin) && !reviewed.has(account.legacyId)) {
    throw new Error(`Review ownership of activated/admin account ${account.legacyId}, then pass --review-activated=${account.legacyId}`);
  }
}
// Exclusive creation prevents silently overwriting codes already handed out.
const fd = openSync(output, 'wx', 0o600);
const result = { deployment: production ? 'production' : 'development', createdAt: new Date().toISOString(), accounts: [] };
try {
  writeFileSync(fd, JSON.stringify(result, null, 2));
  for (const account of pending) {
    const grant = run('passkeys:issueLegacyClaim', { legacyId: account.legacyId, allowActivatedAccount: reviewed.has(account.legacyId) });
    result.accounts.push(grant);
    // Keep successfully issued codes even if a subsequent account fails.
    writeFileSync(output, JSON.stringify(result, null, 2), { mode: 0o600 });
  }
} finally { closeSync(fd); }
console.log(`Saved ${result.accounts.length} individual claim codes to ${output} (permissions 600). Hand each person only their own code; codes expire after seven days.`);
