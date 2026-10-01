# DIGIMONDO migration handover

Prepared 2026-10-01 for the next agent on another machine with Coolify CLI access.

## Objective and user decisions

Move EloMondo from Supabase to Convex, retaining only DIGIMONDO and its dependent
accounts/history. The user has created a free Convex account and authorized this
machine through the CLI. A password reset is acceptable; old passwords and
Supabase sessions will not work in Convex.

Keep Mailpit at `https://mailpit.apps.janjaap.de`, with no credentials. The user
explicitly accepts the shared inbox risk for internal company use and will lock
down its access later. Do not reopen that decision or create Resend. Reset and
verification codes are sent through Mailpit's HTTP `/api/v1/send` API. Users read
their code in Mailpit and enter it in EloMondo.

The live app is on Coolify at `https://elo.janjaap.de`. The previous agent has no
Coolify access. The user requested this handover instead of providing dashboard
access. No live frontend switch, source write freeze, or production data import
has happened.

## Workspace and change state

- Repository: `https://github.com/jappyjan/elo-mondo`.
- Migration branch: `migration/supabase-to-convex`, based on `392a67d` on `main`.
  The migration is committed and pushed on this dedicated branch. `main` was not
  changed, and no pull request was created. Check out this branch before working.
- The previous machine's checkout is `/Users/jappy/code/jappy/elo-mondo`.
  Its local paths, running servers, credentials and ignored files do **not** exist
  on the next agent's machine. This repository is public; never push backups or
  credentials to it.
- Supabase CLI (version 2.101.0) and Convex CLI were authenticated on the previous
  machine only. Authenticate separately on the new machine using the existing
  accounts/project. Do not create a replacement Convex project or assume Coolify
  access also provides Supabase/Convex administrative access. Keep credentials
  in local CLI stores or ignored environment files, outside chat and Git.
- The previous machine's `.env.local` selects the **development** Convex backend.
  `--prod` selects the
  production backend for CLI data/environment commands. `npx convex deploy`
  deploys production; `npx convex dev --once` deploys development.
- Existing unrelated user work was left on the previous machine and excluded:
  `docs/superpowers/plans/2026-06-08-analytics-overhaul.md`,
  `docs/superpowers/specs/2026-06-08-analytics-overhaul-design.md`,
  `docs/superpowers/specs/2026-06-09-statistics-visual-refresh-design.md`, and
  `supabase/migrations/20260623120000_auto_group_membership_on_match.sql`.
- The old tracked `.env` has public Supabase frontend settings. They are unused by
  the migrated app. Original `supabase/` migrations/functions remain for rollback.
- A Vite process was left running on the previous machine on port 8080. Its browser previously
  tested it, but later failed navigation with connection refusal/client errors.
  This was not an observed application exception. Reopen the shared preview and
  inspect its connection before completing browser checks.

## Start on the new machine

```sh
git clone --branch migration/supabase-to-convex git@github.com:jappyjan/elo-mondo.git
cd elo-mondo
npm ci
```

If the repo is already cloned, fetch `origin` and check out the migration branch
without overwriting unrelated local work. Authenticate Convex and use the existing
team/project `mail-janjaap-de` / `elo-mondo`. To use the already-imported development
deployment for rehearsal, create an ignored `.env.local` with public configuration:

```dotenv
CONVEX_DEPLOYMENT=dev:optimistic-cow-111
VITE_CONVEX_URL=https://optimistic-cow-111.eu-west-1.convex.cloud
VITE_CONVEX_SITE_URL=https://optimistic-cow-111.eu-west-1.convex.site
```

Then run `npx convex dev --once` and `npm run dev`. Confirm the CLI selects the
intended existing deployment. Production uses `--prod`; production auth variables
already exist remotely and should not be regenerated just because the machine
changed. Backend code and generated bindings are included in the branch.

For the final export, authenticate the Supabase CLI and link the existing project
with `supabase link --project-ref stzilnijaoxwqyuyryts`. The exporter uses
`supabase db query --linked`; ensure the installed CLI supports that command.
If access is unavailable, obtain it through a secure login/ignored credentials
file before the write freeze. The private original snapshot and verification ZIP
were deliberately excluded from Git; retrieve them through a private file transfer
if needed, or make a new scoped export after obtaining Supabase access. The
development Convex data already exists remotely, but is not a substitute for the
final frozen-source snapshot.

## Source, backups and verified scope

Supabase project `stzilnijaoxwqyuyryts`, Germany (`eu-central-1`). DIGIMONDO UUID
`8195d6b6-f5a5-455d-a9d6-a8adf37970cd`.

Private, ignored scoped backup:

```text
/Users/jappy/code/jappy/elo-mondo/backups/digimondo-20261001T110800292077Z/snapshot.json
/Users/jappy/code/jappy/elo-mondo/backups/digimondo-20261001T110800292077Z/manifest.json
```

A second local copy, including source SQL migrations, is at
`/Users/jappy/.local/share/elo-mondo-backups/digimondo-20261001T110800292077Z/`.
These are two local copies, not an off-machine backup. Backup files contain emails,
password hashes and private invite codes; never commit, print or include them in
an image. Directories/files use permissions 700/600. `.gitignore` and
`.dockerignore` exclude them.

The single-statement SQL snapshot follows memberships and historical references,
so departed participants would be retained. It validates checksums, scope and
every relationship. This is a scoped logical JSON backup with copied source
migrations, not a complete PostgreSQL physical restore image.

| Table/category | Rows |
| --- | ---: |
| groups | 1 |
| group_members | 29 |
| group_invites | 5 |
| group_invite_codes | 1 |
| players | 29 (15 accounts, 14 guests) |
| matches | 271 (86 in 2025, 185 in 2026) |
| match_participants | 730 |
| live_games | 201 (163 completed, 36 abandoned, 2 in progress) |
| live_game_players | 667 |
| game_throws | 17,064 |
| auth_users / auth_identities | 15 / 15, all email |
| MFA factors | 0 |

Do not reuse this snapshot as the final cutover snapshot while Supabase accepts
writes. Take another consistent snapshot after freezing source writes.

## Convex deployments

Team `mail-janjaap-de`, project `elo-mondo`. Both deployments are in Ireland.

| Target | Deployment | Public API URL |
| --- | --- | --- |
| Development | `optimistic-cow-111` | `https://optimistic-cow-111.eu-west-1.convex.cloud` |
| Production | `strong-parakeet-869` | `https://strong-parakeet-869.eu-west-1.convex.cloud` |

Production dashboard:
`https://dashboard.convex.dev/t/mail-janjaap-de/elo-mondo/strong-parakeet-869`.

Production backend code/schema/indexes are deployed. Production `groups` was
checked empty at handover; **production migration data has not been imported**.
Configured production backend variables:

```text
SITE_URL=https://elo.janjaap.de
AUTH_MAILPIT_URL=https://mailpit.apps.janjaap.de
AUTH_EMAIL_FROM=noreply@janjaap.de
JWT_PRIVATE_KEY=<generated and stored in Convex>
JWKS=<generated and stored in Convex>
```

Development has the initial snapshot plus an isolated QA fixture described below.
Its `SITE_URL` is `http://localhost:8080` and its Mailpit settings are equivalent.

## Implementation

- `convex/schema.ts`: business UUIDs remain in `id` and relationships, preserving
  existing group URLs. Convex native IDs are used for auth and database updates.
  Throws add indexed `group_id` for paginated analytics.
- `convex/auth.ts`, `auth.config.ts`, `http.ts`: Convex Auth email/password,
  verification and reset via Mailpit, 15-minute codes. Imported accounts have no
  password secret; reset sets one. `users.legacyId` maintains the existing
  user-to-player relationship and group roles. Guests remain guests.
- `convex/data.ts`: queries, memberships/invites, match recording, analytics and
  Elo. Match/participants/membership insertion is transactional. Private invite
  codes require admin; writes require membership.
- `convex/live.ts`: owner checks and atomic dart/rank/completion/undo persistence.
  Scoring calculation remains client-side, as before. It is not a new
  server-authoritative anti-cheat implementation.
- `convex/eloCalculation.ts`: source Elo algorithm carried across.
- `convex/migration.ts`: admin-only internal imports. Identical retries skip;
  conflicting existing business rows refuse overwrite. This is not a live-sync
  or reconciliation tool.
- Frontend auth, groups, matches, live games and analytics now use Convex.
  Supabase client/types/dependency were removed. Login includes “Set a new
  password” for existing DIGIMONDO users.
- Dockerfile requires `VITE_CONVEX_URL` as a **build argument**. Runtime-only env
  changes cannot change Vite's embedded backend. Docker Compose forwards it.
- The group invitation feature still records invitations, as the previous app
  did; no new invitation-email delivery feature was implemented.

## Migration commands and constraints

Run from the repo root:

```sh
python3 scripts/migration/backup.py
python3 scripts/migration/backup.py --verify /absolute/path/to/snapshot.json
python3 scripts/migration/import.py /absolute/path/to/snapshot.json --dry-run
python3 scripts/migration/import.py /absolute/path/to/snapshot.json --prod
```

`backup.py` requires the existing Supabase CLI link to the exact source project.
It prints only counts and paths. `import.py` validates the source checksum and
references, creates reset-only accounts, imports batches, exports Convex and
compares **every business field plus account mapping** against the source.
Keep its private logs/exports in ignored backup storage.

Important: the import verifier expects an untouched reset-only destination.
After users reset passwords, it intentionally rejects auth secrets/changed
metadata. Do not rerun a pristine-import verification as if it were a validator
for a backend already in active use. The importer also refuses modified live
game rows; do not stage an old production import and assume a later import will
overwrite it. Production was left empty to avoid this problem.

## Verification completed

- Backup checksum, all references and DIGIMONDO-only closure passed.
- Development import/export round trip matched every business row and all 15
  account mappings. Verified archive/report:
  `backups/digimondo-20261001T110800292077Z/convex-dev-20261001T112051130804Z.zip`
  and its `.verification.json` sibling.
- `node scripts/migration/check-elo.mjs`: every rating/history result matched
  Supabase for 2025 and 2026 across all 271 matches, with decay disabled. The
  script reads the development URL from `.env.local`; point a separate client at
  production to repeat there after import. It removes time-dependent
  `daysSinceLastMatch` and normalizes timestamps, order and JSON negative zero.
- Backend tests cover migrated identity/roles, anonymous-write rejection,
  private invites, transactional match rollback, import conflict/retry behavior,
  owner checks and finishing-dart/undo atomicity.
- Frontend and backend type checks passed; test suite passed 14 files / 57 tests.
  ESLint had zero errors (existing warnings). npm production build passed.
- Docker build passed with frozen Bun lockfile and the development API URL.
  Local image `elo-mondo-convex-rehearsal:latest` therefore targets development;
  **do not deploy that image to the live app**. Rebuild with production URL.
- Browser: DIGIMONDO dashboard and analytics loaded. A synthetic imported
  account completed reset through Mailpit and retained its admin group mapping.

Remaining browser checks: wrong-password rejection, sign-out/relogin, new account
verification, live darts/undo/reload/completion and saving results from the UI.
Backend tests passed these persistence primitives, but the full live-game UI
rehearsal did not finish before browser navigation stopped working.

## Isolated development QA fixture

`scripts/migration/rehearsal-fixture.mjs` created only in development:

```text
email: migration-rehearsal@elomondo.invalid
legacy user ID: migration-rehearsal
group ID: migration-rehearsal-group
player IDs: migration-rehearsal-player, migration-rehearsal-guest
membership ID: migration-rehearsal-membership
```

That account has a test password set through reset; it is not in the backup and
will not be imported to production. Use another Mailpit reset for continued QA.
The development backend currently has 16 accounts instead of the snapshot's 15.
The group UI was configured for two players, 301, straight-in/straight-out; check
whether a game exists before continuing. Clean up only this synthetic group's
records and synthetic account/session records when finished. Do not delete
DIGIMONDO. The original round-trip export predates the fixture and remains valid.
Avoid running the fixture script while targeting production.

## Remaining Coolify cutover

1. Inspect Coolify CLI configuration/help and locate the actual resource for
   `elo.janjaap.de`. Determine its repository, branch, build method, deployment
   triggers and current image. Record current config/image for rollback. Do not
   assume it uses this checkout or that a push automatically deploys it.
2. Finish the remaining browser rehearsal on the isolated development fixture.
   Review the pushed migration branch and verify which Git ref Coolify will
   deploy. It can fetch `migration/supabase-to-convex`; if it requires `main`,
   prepare the integration but avoid triggering a live frontend switch before
   production data is ready. Commit/push any subsequent fixes to the migration
   branch and record the final deployment commit.
3. Prepare the Coolify build with
   `VITE_CONVEX_URL=https://strong-parakeet-869.eu-west-1.convex.cloud` as a build
   variable/argument, Dockerfile build, container port 3000 and `/health` check.
   Never put JWT_PRIVATE_KEY, service-role keys, hashes or backups in the image.
   If Coolify uses another build method, ensure Vite sees that production URL
   during the actual build and verify the resulting bundle targets production.
4. Establish a brief source write freeze, including any still-open old clients,
   before the final backup. Stopping the frontend alone does not revoke existing
   direct Supabase access. Choose a source-side scoped write block/maintenance
   mechanism appropriate to the live policies and document how to remove it.
   Finish active games or explicitly preserve their in-progress state.
5. Run `backup.py` again. Verify and copy the new private snapshot plus schema
   sources to separate backup storage. Import the **final** snapshot to the empty
   production Convex deployment with `import.py ... --prod`. Require the complete
   export comparison to pass before switching the live frontend.
6. Repeat Elo parity on production against the frozen source. Inspect counts,
   group roles, guests, matches and throws. Deploy the prepared Coolify frontend.
   Verify `/health`, HTTPS, old DIGIMONDO UUID route, reset through Mailpit,
   password login, analytics and a controlled game/match.
7. Export a production Convex backup and retain source/code/config rollback
   information. Keep Supabase intact until acceptance. No Supabase deletion or
   cancellation has been authorized as a separate destructive operation.

If the frontend must roll back before Convex receives writes, restore the old
Coolify image/config and lift the source write freeze. If Convex has received
new writes, export them first and reconcile them deliberately before restoring
Supabase access; flipping back alone would lose those new records.
