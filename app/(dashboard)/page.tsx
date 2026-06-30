import Link from 'next/link';
import {
  Wallet,
  ArrowRight,
  CreditCard,
  PieChart,
  PiggyBank,
  Repeat,
} from 'lucide-react';
import { requireSession } from '@/lib/auth-server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Money, Pct } from '@/components/money';
import { CategoryIcon } from '@/components/category-icon';
import { BrandLogo } from '@/components/brand-logo';
import { detectBrand } from '@/lib/brands';
import { formatMoney } from '@/lib/money';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from './configuracion/queries';
import { getPeriodsWithTotals } from './meses/queries';
import { getCategories, getExpenses } from './meses/[id]/queries';
import { StatCard } from './_components/stat-card';
import { CategoryPie, type PieDatum } from './_components/category-pie';
import { TrendBar, type TrendDatum } from './_components/trend-bar';

export default async function DashboardPage() {
  const { userId, user } = await requireSession();
  const [periods, settings] = await Promise.all([
    getPeriodsWithTotals(userId),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);
  const locale = country.locale;
  const showUsd = settings.displayCurrency === 'usd';

  if (periods.length === 0) {
    return (
      <Card className="mx-auto mt-8 w-full max-w-xl">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-2xl">
            <Wallet className="size-8" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Hola, {user.name}</h1>
          <p className="text-muted-foreground max-w-sm text-base">
            Todavía no tienes meses cargados. Crea tu primer mes para empezar a
            controlar tus gastos.
          </p>
          <Button size="lg" asChild>
            <Link href="/meses">
              Crear primer mes <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const current = periods[0];
  const [categories, currentExpenses] = await Promise.all([
    getCategories(userId),
    getExpenses(userId, current.id),
  ]);

  // Suscripciones del mes: gastos cuyo concepto coincide con una marca conocida.
  const subscriptions = currentExpenses
    .map((e) => {
      const brand = detectBrand(e.concept);
      if (!brand) return null;
      const local = e.currency === 'USD' ? e.amount * current.dollarRate : e.amount;
      return { id: e.id, concept: e.concept, local, status: e.status };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.local - a.local);
  const subsTotalLocal = subscriptions.reduce((s, x) => s + x.local, 0);
  const subsShare =
    current.totals.totalLocal > 0
      ? (subsTotalLocal / current.totals.totalLocal) * 100
      : 0;

  // Moneda en la que se muestra el dashboard.
  const dispCode = showUsd ? 'USD' : current.localCurrency;
  const altCode = showUsd ? current.localCurrency : 'USD';
  const rate = current.dollarRate;
  // Convierte un valor en moneda local a la moneda de visualización del período p.
  const toDisp = (local: number, r: number) =>
    showUsd ? (r > 0 ? local / r : 0) : local;
  const toAlt = (local: number, r: number) =>
    showUsd ? local : r > 0 ? local / r : 0;

  const pieData: PieDatum[] = categories
    .map((c) => ({
      name: c.name,
      value: Math.round(toDisp(current.totals.byCategory[c.id] ?? 0, rate)),
      color: c.color,
      icon: c.icon,
    }))
    .filter((d) => d.value > 0);

  const trendData: TrendDatum[] = periods
    .slice(0, 6)
    .reverse()
    .map((p) => ({
      label: `${p.label.split(' ')[0].slice(0, 3)} ${String(p.year).slice(2)}`,
      utilizado: Math.round(toDisp(p.totals.totalLocal, p.dollarRate)),
      ingreso: Math.round(toDisp(p.incomeTotal, p.dollarRate)),
    }));

  const over = current.totals.restante < 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-muted-foreground mt-1 text-base">{current.label}</p>
        </div>
        <Button variant="outline" size="lg" asChild>
          <Link href={`/meses/${current.id}`}>
            Ver mes <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ingreso total"
          value={<Money value={toDisp(current.incomeTotal, rate)} currency={dispCode} locale={locale} animateOnMount />}
          sub={<Money value={toAlt(current.incomeTotal, rate)} currency={altCode} locale={locale} animateOnMount />}
          accent="primary"
          icon={<Wallet className="size-6" />}
        />
        <StatCard
          label="Total utilizado"
          value={<Money value={toDisp(current.totals.totalLocal, rate)} currency={dispCode} locale={locale} animateOnMount />}
          sub={<Money value={toAlt(current.totals.totalLocal, rate)} currency={altCode} locale={locale} animateOnMount />}
          accent="sky"
          icon={<CreditCard className="size-6" />}
        />
        <StatCard
          label="Restante"
          value={<Money value={toDisp(current.totals.restante, rate)} currency={dispCode} locale={locale} animateOnMount />}
          sub={<Money value={toAlt(current.totals.restante, rate)} currency={altCode} locale={locale} animateOnMount />}
          valueClass={over ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}
          accent={over ? 'rose' : 'emerald'}
          icon={<PiggyBank className="size-6" />}
        />
        <StatCard
          label="% usado"
          value={<Pct value={current.totals.pctUsado} animateOnMount />}
          sub={<><Money value={toDisp(current.totals.pagadoLocal, rate)} currency={dispCode} locale={locale} animateOnMount /> pagado</>}
          accent="amber"
          icon={<PieChart className="size-6" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gasto por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPie data={pieData} currency={dispCode} locale={locale} />
            <div className="mt-4 flex flex-col gap-1">
              {pieData.map((d) => (
                <div
                  key={d.name}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex size-7 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${d.color}33`, color: d.color }}
                    >
                      <CategoryIcon name={d.icon} className="size-4" />
                    </span>
                    {d.name}
                  </span>
                  <Money value={d.value} currency={dispCode} locale={locale} className="font-semibold tabular-nums" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Tendencia mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBar data={trendData} currency={dispCode} locale={locale} />
          </CardContent>
        </Card>
      </div>

      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="text-muted-foreground size-5" /> Suscripciones
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
            <div>
              <div className="flex items-baseline gap-1.5">
                <Money
                  value={toDisp(subsTotalLocal, rate)}
                  currency={dispCode}
                  locale={locale}
                  className="text-3xl font-semibold tracking-tight tabular-nums"
                  animateOnMount
                />
                <span className="text-muted-foreground text-sm">/ mes</span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {subscriptions.length} activa(s) · {subsShare.toFixed(0)}% del gasto
              </p>
            </div>

            <TooltipProvider delayDuration={100}>
              <div className="flex flex-wrap items-center gap-2.5">
                {subscriptions.slice(0, 10).map((s) => (
                  <Tooltip key={s.id}>
                    <TooltipTrigger asChild>
                      <span className="bg-muted ring-border/50 flex size-11 cursor-default items-center justify-center rounded-full ring-1">
                        <BrandLogo concept={s.concept} className="size-5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="flex flex-col items-center gap-0.5">
                      <span className="font-medium">{s.concept}</span>
                      <span className="tabular-nums">
                        {formatMoney(toDisp(s.local, rate), dispCode, locale)} / mes
                      </span>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {subscriptions.length > 10 && (
                  <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full text-xs font-medium">
                    +{subscriptions.length - 10}
                  </span>
                )}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
