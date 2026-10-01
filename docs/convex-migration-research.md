# Convex migration research

Checked 2026-10-01 against official documentation. Scope: preserve DIGIMONDO users, players, matches, and the dependent records needed to keep their history meaningful. This document contains no credentials or production data.

## Cost and suitability

Convex is not automatically cheaper. Free has no base fee; Starter has a $0 base fee with usage charges; Professional costs $25 per developer/month. Supabase Free is $0 and Pro starts at $25/month. Savings depend on the current Supabase bill and actual workload, which have not been inspected. [Convex pricing](https://www.convex.dev/pricing), [Supabase pricing](https://supabase.com/pricing)

Convex Free includes 0.5 GB database storage, 1 GB/month database I/O, and 1 million function calls/month. Database indexes count toward storage and reads count toward I/O. EU resource pricing is 1.3 times US pricing. Free imposes resource caps; Starter permits usage billing beyond included resources. Measure the imported dataset and expected reactive-query traffic before choosing a paid tier. [Convex limits](https://docs.convex.dev/production/state/limits)

Supabase Free includes 500 MB database storage, 50,000 monthly active users and 5 GB egress, but projects pause after one week of inactivity. Its Pro plan includes daily backups retained seven days. These units are not directly comparable with Convex function calls and database I/O. [Supabase pricing](https://supabase.com/pricing)

For this React/Vite application, Convex supports the frontend architecture, but SQL queries, RPCs and RLS need replacement with backend functions and explicit authorization. This is an application migration, not a connection-string replacement. [Convex authentication and authorization](https://docs.convex.dev/auth/overview), [local stack](../README.md)

## Start without an account

Install `convex`, then run `npx convex dev` and choose local development without an account. Local data is stored under `~/.convex`; the CLI creates configuration and the `convex/` directory. Later, `npx convex login` creates/logs into an account and links the local project; a cloud production deployment requires an account. This permits implementation and rehearsals before asking the user to complete signup. [Convex development workflow](https://docs.convex.dev/understanding/workflow)

## Users and authentication

The application currently exposes email/password sign-in and sign-up in [AuthContext.tsx](../src/contexts/AuthContext.tsx); live authentication methods still need inspection. A player is not necessarily an authentication account: temporary/unclaimed players must survive without fabricating credentials.

Convex Auth runs within Convex and supports password, email-code/magic-link and OAuth flows. It is explicitly beta and may change incompatibly. Supported external authentication integrations are another option, but introduce their own account, migration and pricing requirements. [Convex auth overview](https://docs.convex.dev/auth/overview)

Supabase stores bcrypt password hashes in `auth.users.encrypted_password`, not recoverable plaintext passwords. Supabase documents that exporting the auth schema preserves hashed passwords for a Supabase-to-Supabase migration; that does not establish compatibility with another auth system. Direct SQL/auth-schema backup access is needed for a hash-preserving export. [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [Supabase auth migration](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

Convex Auth's default password implementation uses scrypt, so copied bcrypt hashes cannot authenticate through the default verifier. The `Password` provider documents custom `crypto.hashSecret` and `crypto.verifySecret` functions. **Feasible engineering path:** import existing hashes into correctly mapped auth accounts and use a tested bcrypt-capable verifier (possibly alongside scrypt for new credentials). This requires a custom importer; the docs do not provide a turnkey Supabase-auth migration command. Never hash an already-hashed password as if it were a plaintext credential. [Password provider API](https://labs.convex.dev/auth/api_reference/providers/Password), [Password implementation](https://github.com/get-convex/convex-auth/blob/main/src/providers/Password.ts)

An alternative is to import account/profile associations, then require users to prove email ownership and set a new password. Convex's reset flow needs a configured email provider, so email delivery/sender setup is an additional dependency. This changes the first-login experience and should be an explicit user decision. [Password/reset setup](https://labs.convex.dev/auth/config/passwords)

Convex Auth represents provider accounts separately from users and allows multiple accounts per user. Its callbacks control user creation and linking. The importer must preserve a stable legacy-user-ID mapping and account email-verification state rather than creating new unrelated players. [Convex Auth server API](https://labs.convex.dev/auth/api_reference/server)

If live users have OAuth identities, back up their provider and provider-specific subject, configure provider credentials and new callback URLs, and reconnect the identity to its existing migrated user. Do not presume that existing Supabase sessions or OAuth tokens become Convex sessions. OAuth subject matching and existing verified-email linking must be rehearsed; unverified-email matching can incorrectly merge accounts. [OAuth configuration](https://labs.convex.dev/auth/config/oauth), [account linking rules](https://labs.convex.dev/auth/advanced)

A temporary bridge can retain Supabase Auth while moving application data: Convex accepts custom JWT providers with RS256/ES256 and exact issuer/audience matching; Supabase supports asymmetric signing keys and publishes JWKS. This is a conditional staged-migration option, not a completed exit from Supabase. A project using legacy HS256 cannot use that direct Convex custom-JWT path unchanged. [Convex custom JWT](https://docs.convex.dev/auth/advanced/custom-jwt), [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys)

## Backup, import and verification

Supabase's CLI backup procedure exports roles, schema and data using a database connection string. Storage file contents require separate copying. For a DIGIMONDO-only export, use a consistent database snapshot and scoped queries; verify auth rows/hashes are present instead of assuming a public-schema export contains them. Keep the original SQL backup and filtered JSON export separately from the Convex transformation. [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

Convex CLI imports JSON arrays, JSONL or CSV; JSONL avoids the 8 MiB JSON-array cap and preserves JSON types better than CSV inference. Postgres UUIDs cannot be used as Convex `_id`: store them as legacy ID fields, then build mappings for references. Imports default to development; production requires `--prod`. Existing-table imports fail unless append/replace is requested. Import is beta and uses bandwidth. [Convex data import](https://docs.convex.dev/database/import-export/import)

Convex backups/export ZIPs preserve Convex IDs and references and can be imported into another deployment. Free/Starter permit two stored backups per deployment, accessible seven days. Backups exclude deployment code/configuration, pending scheduled functions and environment variables; keep those separately. [Convex backups](https://docs.convex.dev/database/backup-restore), [CLI export](https://docs.convex.dev/database/import-export/export)

Recommended migration gates (engineering judgment):

1. Confirm the unique DIGIMONDO group ID and export its complete dependency graph, including historical participants who left the group.
2. Produce a scoped immutable backup with row counts, checksums, schema and auth identities; test restoration before any cutover.
3. Rehearse importing into a local/development Convex deployment, verifying match counts/order, ratings/history, group roles, temporary players and legacy references.
4. Test correct/incorrect password login, reset, authorization and imported verified-email behavior; decide hash preservation versus reset after inspecting the live auth export.
5. Create the cloud project in the chosen region, configure authentication/email delivery, repeat import and validation there.
6. Freeze old-app writes briefly, take the final consistent export, validate the imported snapshot, then switch the application deployment. Keep the old deployment and backup available until rollback and acceptance checks pass.

## Unknowns requiring live access or a user decision

- Current Supabase plan/usage, DIGIMONDO row counts, auth methods, password-hash formats, storage usage, and whether historical records reference nonmembers.
- Whether existing passwords must continue working or a one-time reset is acceptable.
- Cloud data region, email provider/sender setup, and a short cutover write-freeze window.
- Current Vercel project/build/environment settings and production domain.

No remote project was created, production data exported, or live application changed during this research.
