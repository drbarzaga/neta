# Neta — Gestor de gastos mensuales

App para gestionar gastos mensuales (reemplazo del Google Sheet): tabla por mes estilo
planilla, multimoneda UYU/USD con cotización automática del dólar, dashboard con gráficos,
analítica mes a mes y correos (recordatorios de vencimiento, resumen mensual y alertas de
presupuesto).

## Stack

- **Next.js 16** (App Router, `proxy.ts`) · React 19 · TypeScript
- **Tailwind v4 + shadcn/ui** (preset `b4OF7scDY`, iconos remixicon)
- **Drizzle ORM + Neon (Postgres)**
- **Better Auth** (email/contraseña, multiusuario)
- **React Email + Resend** (correos)
- **Recharts** (gráficos) · nuqs · sonner · react-hook-form + zod
- **bun** como gestor de paquetes · deploy en **Vercel** (cron vía `vercel.json`)

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   bun install
   ```

2. Copiar variables de entorno y completarlas:

   ```bash
   cp .env.example .env
   ```

   | Variable | Para qué |
   |---|---|
   | `DATABASE_URL` | Cadena de conexión de Neon (Postgres) |
   | `BETTER_AUTH_SECRET` | Secreto de sesión (string largo aleatorio) |
   | `BETTER_AUTH_URL` | URL base (`http://localhost:3000` en local) |
   | `RESEND_API_KEY` | API key de Resend (correos). Sin ella, los envíos se omiten |
   | `EMAIL_FROM` | Remitente, ej. `Neta <onboarding@resend.dev>` |
   | `CRON_SECRET` | Protege los endpoints `/api/cron/*` |
   | `NEXT_PUBLIC_APP_URL` | URL pública (links en correos) |

3. Crear las tablas y (opcional) cargar datos de ejemplo:

   ```bash
   bun run db:migrate     # aplica db/migrations
   bun run db:seed        # usuario demo@finanzas.local / changeme123 + mes "Marzo de 2026"
   ```

4. Levantar en desarrollo:

   ```bash
   bun run dev
   ```

   Abrí http://localhost:3000 → registrá una cuenta (o usá el usuario demo si corriste el seed).

## Scripts

| Script | Acción |
|---|---|
| `bun run dev` | Servidor de desarrollo |
| `bun run build` / `start` | Build de producción / servir |
| `bun run check-types` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run db:generate` | Genera migración desde el schema |
| `bun run db:migrate` / `db:push` | Aplica migraciones / push directo |
| `bun run db:studio` | Drizzle Studio |
| `bun run db:seed` | Datos de ejemplo |
| `bun run email:dev` | Previsualizar plantillas de correo (React Email) |

## Estructura

```
app/
  (auth)/            login, register, forgot/reset password
  (dashboard)/       resumen (/), meses, meses/[id], analitica, categorias, importar, configuracion
  api/auth/[...all]  handler de Better Auth
  api/cron/*         endpoints de notificaciones y cotización (protegidos por CRON_SECRET)
db/                  schema Drizzle, migraciones, seed, conexión
emails/              plantillas React Email
lib/                 auth, money, exchange-rate, notifications, sheet-parser, dates, ...
```

Cada módulo del dashboard sigue el patrón `page.tsx` (RSC) + `schema.ts` (Zod) +
`actions.ts` (`"use server"`) + `queries.ts` + `_components/`.

## Importar tu Google Sheet

En la sección **Importar**: descargá la pestaña del mes como CSV (Archivo → Descargar → CSV
en Google Sheets) y subila. El parser detecta automáticamente *Ingreso total*, *Dólar*, la
fila de encabezados y los gastos; revisás la vista previa y confirmás.

## Correos y cron (Vercel)

`vercel.json` define 4 crons que llaman a `/api/cron/*`. Vercel agrega automáticamente el
header `Authorization: Bearer $CRON_SECRET`. Para probarlos en local:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-rate
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/due-reminders
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/budget-alert
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/monthly-summary
```

Las preferencias de cada correo (activar/desactivar, días de anticipación, umbral de
presupuesto) se ajustan en **Configuración**.

## Deploy

Subí el repo a Vercel, configurá las variables de entorno (incluyendo `CRON_SECRET` para
activar los crons) y conectá la base de Neon. Ejecutá `bun run db:migrate` contra la BD de
producción.
