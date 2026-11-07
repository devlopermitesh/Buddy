# SocialFlow

SocialFlow is a workspace based social media planning app built with Next.js, TypeScript, Prisma and SQLite. It implements the product sitemap and the authentication/onboarding flows in the Board 1 and Board 2 specifications.

## Run locally

```bash
npm install
Copy-Item .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. The seed script creates a ready to explore workspace and demo users:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@socialflow.test` | `Password123!` |
| Manager | `manager@socialflow.test` | `Password123!` |
| Executive | `exec@socialflow.test` | `Password123!` |

New registrations, invitations and password resets write email links to the local outbox at `/dev/outbox`.

## Included areas

- Sign up, email verification, login lockout, password reset, invitation acceptance and session expiry handling
- Workspace creation, team invitations, role based navigation and server side permission checks
- Dashboard, notifications, content studio, media library, calendar, publishing queue and approvals
- AI scheduling, automation, tasks, campaigns, analytics, reports, team, accounts, Discord settings and audit logs
- SQLite development data, seeded demo workspace, publishing worker and health/cron endpoints

The product spec and database reference are in `docs/`.

## Integrations

The default local setup uses mock social account connections and a simulated publishing adapter. Discord setup is also a local demo flow. The Meta and Discord environment variables are included as configuration points, but real OAuth, provider publishing, Discord bot delivery and SMTP transport still need provider adapters and credentials before deployment. Do not use demo tokens or seeded accounts in production.

## Commands

```bash
npm run dev         # local app
npm run typecheck   # TypeScript check
npm run build       # production build
npm run worker      # background publishing worker
npm run db:studio   # inspect local database
```

The default `.env.example` database URL uses SQLite. Set `DATABASE_URL` to a supported production database and provision durable storage, mail delivery and provider integrations before deploying.
