# EloMondo

Track your dart games with Elo ratings. Compete with friends, track your progress, and see who's the best!

## Features

- **Elo Rating System** - Fair skill-based rankings
- **Live Game Tracking** - Track games in real-time
- **Groups** - Create groups for your dart leagues
- **Analytics** - View detailed statistics and trends
- **Head-to-Head** - Compare performance against specific players
- **Passkey authentication** - Sign in without email, passwords, or external login providers

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Convex and Convex Auth (backend)
- Coolify / Docker (hosting at `https://elo.janjaap.de`)

## Development

```sh
# Install dependencies
npm install

# Configure the development backend and generate .env.local
npx convex dev --once

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

Deploy backend changes with `npx convex deploy`. Set the Docker build argument
`VITE_CONVEX_URL` to the production deployment URL in Coolify; Vite embeds it at
build time. Private auth variables belong in Convex, never in the frontend image.

The Supabase-to-Convex cutover is complete. See
[the migration handover](docs/convex-migration-handover.md) for historical backup
and deployment evidence. The retained `supabase/` sources support backup and rollback.

The current source uses passkeys and individual legacy claim codes. See
[passkey configuration and cutover](docs/passkey-auth-operations.md) before deploying
this authentication change to production. It includes deletion of all old password
sessions, refresh tokens, reset grants, and email-account records. The implementation
is verified on the development backend; production rollout is still pending.
