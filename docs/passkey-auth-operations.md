# Passkey authentication and cutover

The application now uses passkeys directly, with Convex Auth managing tokens and refresh sessions. There are no Password/Email providers, password reset/verification flows, or email invitation endpoints. Optional passkey syncing is the user's choice; EloMondo calls no external identity provider.

## Configuration

Production defaults are `PASSKEY_ORIGIN=https://elo.janjaap.de` and `PASSKEY_RP_ID=elo.janjaap.de`. The backend requires the exact origin and hostname; it does not accept arbitrary client-supplied origins or parent-domain RP IDs. The frontend redirects `elo.apps.janjaap.de` to the canonical host, preserving paths. Keep the RP ID stable.

Development:

```sh
npx convex env set PASSKEY_ORIGIN http://localhost:8080
npx convex env set PASSKEY_RP_ID localhost
npx convex dev --once
npm run dev
```

`convex.json` selects Node 22 for verifier actions. The npm aliases `@elomondo/webauthn-browser` and `@elomondo/webauthn-server` pin SimpleWebAuthn 14 without conflicting with Auth.js's optional SimpleWebAuthn 9 peers. Both npm and Bun locks are updated. Existing Convex JWT keys/issuer configuration remain required.

## Production switch

Complete these steps as one coordinated backend/frontend rollout. They are operator commands, not public application endpoints. The implementation was deployed to development for verification; production was not deployed or modified during implementation.

1. Take a fresh private Convex export. Preserve historical backups for rollback; they contain old emails/password metadata even after live cleanup.
2. Set production `PASSKEY_ORIGIN` and `PASSKEY_RP_ID` to the production values above and deploy the backend with `npx convex deploy`. This immediately removes password login and blocks all legacy JWTs from business operations because they lack a passkey-session proof.
3. Review `npx convex run --prod passkeyStore:auditLegacy '{}'`. It reports stable user IDs/names, migration state, and whether password/session/admin records require ownership review. No public claimable-user directory exists.
4. Generate individual claim codes into a private, gitignored file. The owner/admin must be explicitly reviewed even when its password was previously wiped:

   ```sh
   node scripts/auth/prepare-claims.mjs --prod --output=.passkey-claims.local --review-activated=OWNER_LEGACY_UUID
   ```

   Substitute the owner's existing legacy UUID from the audit; for this cutover the owner is the existing `mail@janjaap.de` account. The script refuses activated/admin accounts without a matching review flag, creates the file exclusively with permissions 600, never prints secrets, and checkpoints successfully generated codes. Give each player only their own code, directly. Do not send the whole file. Codes expire after seven days. Reissuing a code revokes its predecessor; completed accounts can never be reclaimed. No shared migration password exists.
5. Check `npx convex run --prod passkeyStore:retireEmailAuth '{"dryRun":true}'`. Every enabled account must either have a passkey or a valid individual claim grant before cleanup can proceed.
6. Publish the frontend containing the matching passkey flows. Preserve the existing production Convex URL in the Docker build. Verify the owner can claim the existing player, access the original group as admin, and save recovery codes.
7. Run `npx convex run --prod passkeyStore:retireEmailAuth '{"dryRun":false}'`. This physically deletes all legacy sessions, their refresh tokens/verifiers, all old password account records and verification/reset grants, old auth rate limits and email invitations. It removes live user emails/verification times. Existing passkey sessions are retained. Business tables and legacy user/player IDs are preserved. Delete `AUTH_MAILPIT_URL` and `AUTH_EMAIL_FROM` from the deployment environment; email delivery is no longer used.
8. Confirm old login/reset providers fail; verify passkey sign-out/relogin, account security, a second key and recovery on real devices. If rolling back, use a fresh export to reconcile any business writes and passkey registrations first. Old password/session data is deliberately not preserved in the live backend.

## Security behavior

- Registration requires discoverable credentials and user verification. The server checks signatures, exact origin/RP ID, challenge, user handle and counters; valid zero counters from synced passkeys are supported.
- Challenges expire after five minutes, are bound to a secret browser nonce and purpose, and allow one verification attempt. Failed verification consumes the attempt but leaves an unconsumed claim/recovery code usable with a new challenge.
- Claim/recovery codes contain 256 random bits. Only SHA-256 hashes are stored. Consuming a grant, registering the key, and creating the authenticated session proof are atomic. Concurrent claims cannot create two owners.
- Old signed JWTs are rejected even before expiry: every business operation checks the live session, its passkey proof, credential and account epoch. Disabled users and revoked keys cannot use stale tokens.
- Recovery codes authorize replacement-key registration only. Successful recovery revokes every old session/key/code and issues five replacement recovery codes. There is no email recovery. A second independent passkey/security key is preferable. If every key and code is lost, recovery requires a deliberate operator identity check and database administration; display-name knowledge is insufficient.
- Adding/removing/renaming passkeys or regenerating recovery codes requires a passkey proof from the last five minutes. The UI asks for fresh proof. At least one passkey must remain. Removing a key revokes sessions that used it.
- Global limits allow 200 begin and 200 verify attempts per five-minute window, plus 30 verified-account attempts per user. Counts persist even when later verification fails. Convex actions do not supply a trusted client IP; global limits can cause temporary denial of service if abused. For larger deployments, put registration behind invitations or add an HTTP edge limit.
- Credential/challenge/grant tables have no public data query. Public credential listings expose only labels and timestamps for the authenticated owner. An hourly cron removes old challenge records.

## Validation

The automated backend suite exercises the real SimpleWebAuthn verifier using generated EC keys, CBOR registrations and signed assertions, including Convex Auth token issuance/refresh. It covers claim races/replays, expiry/nonce/origin/RP/signature/UV/handle failures, zero counters, disabled users, recent-session checks, recovery, credential revocation, legacy ID/role preservation and physical password/session/reset cleanup. Browser UI checks and React tests cover email-free forms and saving recovery codes.

A smoke test against the deployed development backend also passed registration, authenticated viewer lookup, login, refresh, second-key enrollment, rename and recovery with genuine signed assertions. Its synthetic account and all keys/sessions/grants were removed afterward. The collaborative preview displayed the sign-in/signup forms, but later navigation failed at its browser connection; automated UI state tests passed independently. Real Safari/iOS and Chrome/Android passkey prompts still need an operator/device check at rollout.
