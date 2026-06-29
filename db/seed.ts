/**
 * Seed de desarrollo. Crea un usuario demo, sus categorías y un mes de ejemplo
 * con los datos de la planilla original (Marzo de 2026).
 *
 *   bun run db:seed   (requiere DATABASE_URL en .env)
 */
import { db, eq, user, category, period, expense, emailPreference } from './index';
import { auth } from '@/lib/auth';

const DEMO_EMAIL = 'demo@finanzas.local';
const DEMO_PASSWORD = 'changeme123';
const DEMO_NAME = 'Demo';

type Currency = 'UYU' | 'USD';

interface SeedExpense {
  concept: string;
  amount?: number;
  currency?: Currency;
  dueDate?: string;
}

const SEED_CATEGORIES: {
  name: string;
  color: string;
  icon: string;
  expenses: SeedExpense[];
}[] = [
  {
    name: 'PAGARTE PRIMERO',
    color: '#86efac',
    icon: 'piggy-bank',
    expenses: [
      { concept: 'AUTO (ITAU USD)', amount: 40400 },
      { concept: 'Fondo 5% (BROU USD)' },
      { concept: 'Ahorro Extra (BROU USD)' },
    ],
  },
  {
    name: 'TARJETAS',
    color: '#93c5fd',
    icon: 'credit-card',
    expenses: [
      { concept: 'BROU USD', currency: 'USD' },
      { concept: 'BROU PESOS' },
      { concept: 'ITAU USD', amount: 0, currency: 'USD' },
      { concept: 'ITAU PESOS' },
    ],
  },
  {
    name: 'GASTOS FIJOS',
    color: '#5eead4',
    icon: 'home',
    expenses: [
      { concept: 'Alquiler', amount: 28564 },
      { concept: 'Internet' },
      { concept: 'Teléfono', amount: 2292 },
      { concept: 'Tributos domiciliarios' },
      { concept: 'Saneamiento', amount: 1008, dueDate: '2026-08-01' },
      { concept: 'Celular mamá' },
      { concept: 'Envio Mami Prex' },
    ],
  },
  {
    name: 'VARIABLES',
    color: '#bfdbfe',
    icon: 'shopping-cart',
    expenses: [
      { concept: 'Comida' },
      { concept: 'Pago Certifico Notarial' },
      { concept: 'STM' },
      { concept: 'Arreglo Cortina Venta', amount: 0 },
      { concept: 'Arreglo Purta Cocina', amount: 0 },
      { concept: 'Pago seguro de Viaje Amorcito' },
    ],
  },
];

async function main() {
  console.log('› Seed iniciado');

  // 1. Usuario demo (vía Better Auth para que el password quede bien hasheado).
  let [existing] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL));
  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
    });
    [existing] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL));
    console.log(`  ✓ usuario creado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`  • usuario ya existe: ${DEMO_EMAIL}`);
  }
  const userId = existing.id;

  // 2. Preferencias de email.
  const [pref] = await db
    .select()
    .from(emailPreference)
    .where(eq(emailPreference.userId, userId));
  if (!pref) {
    await db.insert(emailPreference).values({ userId });
  }

  // 3. Categorías (idempotente por nombre).
  const existingCats = await db.select().from(category).where(eq(category.userId, userId));
  if (existingCats.length > 0) {
    console.log('  • categorías ya existen, se omite el mes de ejemplo');
    console.log('› Seed completo');
    return;
  }

  const catIds: Record<string, string> = {};
  for (let i = 0; i < SEED_CATEGORIES.length; i++) {
    const c = SEED_CATEGORIES[i];
    const [row] = await db
      .insert(category)
      .values({ userId, name: c.name, color: c.color, icon: c.icon, sortOrder: i })
      .returning();
    catIds[c.name] = row.id;
  }
  console.log(`  ✓ ${SEED_CATEGORIES.length} categorías creadas`);

  // 4. Mes de ejemplo: Marzo de 2026.
  const [p] = await db
    .insert(period)
    .values({
      userId,
      label: 'Marzo de 2026',
      year: 2026,
      month: 3,
      incomeTotal: 179288,
      dollarRate: 40.4,
      status: 'open',
    })
    .returning();

  // 5. Gastos del mes.
  let order = 0;
  for (const c of SEED_CATEGORIES) {
    for (const e of c.expenses) {
      await db.insert(expense).values({
        userId,
        periodId: p.id,
        categoryId: catIds[c.name],
        concept: e.concept,
        amount: e.amount ?? 0,
        currency: e.currency ?? 'UYU',
        status: 'pendiente',
        dueDate: e.dueDate ?? null,
        sortOrder: order++,
      });
    }
  }
  console.log(`  ✓ mes "Marzo de 2026" con ${order} gastos`);
  console.log('› Seed completo');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
