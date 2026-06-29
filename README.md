<h1 align="center">Neta</h1>

Monthly budgeting app: per-month expense table, multi-currency with automatic USD exchange
rate, dashboard with charts, an AI financial advisor, and emails (due-date reminders,
monthly summary, and budget alerts).

<p>
  <strong>Supported countries:</strong><br>
  🇺🇾&nbsp;Uruguay &nbsp;·&nbsp; 🇦🇷&nbsp;Argentina &nbsp;·&nbsp; 🇨🇱&nbsp;Chile &nbsp;·&nbsp;
  🇧🇷&nbsp;Brazil &nbsp;·&nbsp; 🇲🇽&nbsp;Mexico &nbsp;·&nbsp; 🇧🇴&nbsp;Bolivia &nbsp;·&nbsp;
  🇨🇴&nbsp;Colombia &nbsp;·&nbsp; 🇻🇪&nbsp;Venezuela
</p>

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 + shadcn/ui · Drizzle + Neon
(Postgres) · Better Auth (email + passkeys) · Anthropic (Claude) · React Email + Resend ·
deployed on Vercel · bun.

## Getting started

> **Prerequisites:** [bun](https://bun.sh) and a [Neon](https://neon.tech) Postgres database.

**1. Install dependencies**
```bash
bun install
```

**2. Configure environment** — copy the example file and fill it in (see below)
```bash
cp .env.example .env
```

**3. Set up the database**
```bash
bun run db:migrate   # create tables
bun run db:seed      # optional: sample data
```

**4. Run it** → http://localhost:3000
```bash
bun run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon (Postgres) connection string |
| `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` | Session secret and base URL |
| `RESEND_API_KEY` · `EMAIL_FROM` | Emails. Without the key, sending is skipped |
| `CRON_SECRET` | Protects the `/api/cron/*` endpoints |
| `NEXT_PUBLIC_APP_URL` | Public URL (used in email links) |

> **AI advisor (BYOK):** no API key is needed in the server env. Each user pastes their own
> key (Anthropic or OpenRouter) in **Settings**; it's validated and stored encrypted.
> `ANTHROPIC_API_KEY` is supported only as an optional shared fallback.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start the dev server |
| `bun run build` / `start` | Production build / serve |
| `bun run check-types` | Type-check with `tsc` |
| `bun run lint` | Lint with ESLint |
| `bun run db:generate` | Generate a migration from the schema |
| `bun run db:migrate` / `db:push` | Apply migrations / push schema directly |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed sample data |
| `bun run email:dev` | Preview email templates |

## Notes

- **Import:** in the *Importar* section, upload the CSV of your Google Sheets tab; the parser
  detects income, exchange rate, headers, and expenses for you to review and confirm.
- **Cron (Vercel):** `vercel.json` defines the `/api/cron/*` jobs (exchange rate and emails),
  protected by `CRON_SECRET`. Email preferences are managed in *Configuración*.
- **Deploy:** push the repo to Vercel, set the environment variables, and run
  `bun run db:migrate` against the production database.
</content>
