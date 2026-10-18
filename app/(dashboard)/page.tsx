import Link from 'next/link';
import {
  Wallet,
  ArrowRight,
  CreditCard,
  PieChart,
  PiggyBank,
  Repeat,
  Clock,
  Target,
  Sparkles,
} from 'lucide-react';
import { requireSession } from '@/lib/auth-server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { BrandLogo } from '@/components/brand-logo';
import { CategoryIcon } from '@/components/category-icon';
import { AskAdvisorButton } from '@/components/advisor/ask-advisor-button';
import { detectBrand } from '@/lib/brands';
import { formatMoney } from '@/lib/money';
import { getCountry } from '@/lib/countries';
import { buildAdvisorInsights, type AdvisorInsight } from '@/lib/advisor-context';
import { getOrCreateUserSettings } from './configuracion/queries';
import { getPeriodsWithTotals } from './meses/queries';
import { getCategories, getExpenses } from './meses/[id]/queries';
import { getGoals } from './metas/queries';
import { StatCard } from './_components/stat-card';
import { CategoryStack } from './_components/category-stack';
import type { PieDatum } from './_components/category-pie';
import { TrendBar, type TrendDatum } from './_components/trend-bar';

/** El insight más relevante primero: alerta > advertencia > todo en orden. */
const LEVEL_PRIORITY: Record<AdvisorInsight['level'], number> = {
  alert: 0,
  warn: 1,
  ok: 2,
};

function topInsights(insights: AdvisorInsight[], n: number): AdvisorInsight[] {
  return [...insights]
    .sort((a, b) => LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level])
    .slice(0, n);
}

export default async function DashboardPage() {
  const { userId, user } = await requireSession();
  const [periods, settings, insights] = await Promise.all([
    getPeriodsWithTotals(userId),
    getOrCreateUserSettings(userId),
    buildAdvisorInsights(userId),
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

  // "Actual" es siempre el mes de hoy, no el más reciente que exista: con
  // "Crear año completo" puede haber meses futuros ya cargados (ej. todo
  // 2027), y no queremos que el Resumen salte a diciembre de 2027 por error.
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  // `periods` viene ordenado del más reciente al más antiguo, así que esto
  // conserva ese orden quedándose solo con los meses de hoy hacia atrás.
  const pastOrCurrent = periods.filter(
    (p) => p.year < curYear || (p.year === curYear && p.month <= curMonth)
  );
  const current =
    pastOrCurrent.find((p) => p.year === curYear && p.month === curMonth) ??
    pastOrCurrent[0] ??
    periods[periods.length - 1];
  const [categories, currentExpenses, goals] = await Promise.all([
    getCategories(userId),
    getExpenses(userId, current.id),
    getGoals(userId),
  ]);
  const activeGoal = goals.find((g) => !g.completed) ?? null;
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const pendientes = currentExpenses
    .filter((e) => e.status !== 'pagado')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .slice(0, 6);

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

  // Igual que `current`: la tendencia mira hacia atrás desde hoy, nunca
  // hacia meses futuros ya creados por adelantado.
  const trendSource = pastOrCurrent.length > 0 ? pastOrCurrent : periods;
  const trendData: TrendDatum[] = trendSource
    .slice(0, 6)
    .reverse()
    .map((p) => ({
      label: `${p.label.split(' ')[0].slice(0, 3)} ${String(p.year).slice(2)}`,
      utilizado: Math.round(toDisp(p.totals.totalLocal, p.dollarRate)),
      ingreso: Math.round(toDisp(p.incomeTotal, p.dollarRate)),
    }));

  const over = current.totals.restante < 0;
  const shownInsights = topInsights(insights, 2);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{current.label}</p>
          <h1 className="font-heading mt-1 text-[46px] leading-none font-bold tracking-tight [letter-spacing:-0.025em]">
            Resumen
          </h1>
        </div>
        <Button variant="outline" size="lg" asChild>
          <Link href={`/meses/${current.id}`}>
            Ver mes <ArrowRight />
          </Link>
        </Button>
      </div>

      {shownInsights.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Tu asesor financiero dice</p>
                <ul className="text-muted-foreground space-y-0.5 text-sm">
                  {shownInsights.map((ins, i) => (
                    <li key={i} className="leading-snug">
                      {ins.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <AskAdvisorButton
              prompt="Dame un resumen de mi situación financiera actual"
              label="Hablar con el asesor"
              className="shrink-0 self-start sm:self-auto"
            />
          </CardContent>
        </Card>
      )}

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
          valueClass={over ? 'text-[var(--coral)]' : undefined}
          variant="forest"
          icon={<PiggyBank className="size-6" />}
        />
        <StatCard
          label="% usado"
          value={<Pct value={current.totals.pctUsado} animateOnMount />}
          sub={<><Money value={toDisp(current.totals.pagadoLocal, rate)} currency={dispCode} locale={locale} animateOnMount /> pagado</>}
          accent="amber"
          progress={current.totals.pctUsado}
          icon={<PieChart className="size-6" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gasto por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryStack data={pieData} currency={dispCode} locale={locale} />
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

      {(pendientes.length > 0 || activeGoal) && (
        <div className="grid gap-4 lg:grid-cols-5">
          {pendientes.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-5 text-(--ink-3)" /> Pendientes de pagar
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col">
                {pendientes.map((e) => {
                  const cat = categoryById.get(e.categoryId);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 border-t border-(--line) py-3.5 first:border-t-0"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${cat?.color ?? '#848E87'}26`, color: cat?.color ?? 'var(--ink-3)' }}
                        >
                          <CategoryIcon name={cat?.icon} className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{e.concept}</span>
                          {e.dueDate && (
                            <span className="font-mono text-xs text-(--ink-3)">
                              Vence{' '}
                              {new Date(`${e.dueDate}T00:00:00`).toLocaleDateString(locale, {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <Badge variant={e.status === 'vencido' ? 'coral' : 'amber'}>
                          {e.status === 'vencido' ? 'Vencido' : 'Pendiente'}
                        </Badge>
                        <Money
                          value={toDisp(e.currency === 'USD' ? e.amount * current.dollarRate : e.amount, rate)}
                          currency={dispCode}
                          locale={locale}
                          className="w-20 text-right text-sm font-medium tabular-nums"
                        />
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {activeGoal && (
            <Card variant="ink" className={pendientes.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Target className="size-5 text-(--lime)" /> Meta activa
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-lg font-semibold text-white">{activeGoal.title}</p>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-(--lime)"
                    style={{
                      width: `${Math.min(100, Math.max(0, activeGoal.targetAmount > 0 ? (activeGoal.savedAmount / activeGoal.targetAmount) * 100 : 0))}%`,
                    }}
                  />
                </div>
                <div className="flex items-baseline justify-between font-mono text-sm tabular-nums">
                  <span className="text-white">
                    {formatMoney(activeGoal.savedAmount, activeGoal.currency, locale)}
                  </span>
                  <span className="text-(--sb-mute)">
                    de {formatMoney(activeGoal.targetAmount, activeGoal.currency, locale)}
                  </span>
                </div>
                <Button variant="lime" size="sm" className="mt-1 w-fit" asChild>
                  <Link href="/metas">
                    Ver metas <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
