import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  RiBarChartBoxLine,
  RiCoinsLine,
  RiArrowRightUpLine,
  RiFireLine,
  RiCheckboxBlankCircleLine,
  RiWalletLine,
  RiPercentLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiSubtractLine,
} from '@remixicon/react';
import { Money } from '@/components/money';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getPeriodsWithTotals } from '../meses/queries';
import { getCategories } from '../meses/[id]/queries';
import { StatCard } from '../_components/stat-card';
import {
  CategoryAreaChart,
  StatusBarChart,
  IncomeExpenseChart,
  type MonthlyRow,
  type CategoryMeta,
} from './_components/analytics-charts';

export const metadata: Metadata = { title: 'Analítica — Neta' };

export default async function AnalyticsPage() {
  const { userId } = await requireSession();
  const [periods, categories, settings] = await Promise.all([
    getPeriodsWithTotals(userId),
    getCategories(userId),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);
  const locale = country.locale;
  const localCurrency = country.currency;

  if (periods.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <RiBarChartBoxLine className="text-muted-foreground size-12" />
          <p className="font-medium">Sin datos para analizar</p>
          <p className="text-muted-foreground text-sm">
            Crea meses y carga gastos para ver tu evolución.
          </p>
        </CardContent>
      </Card>
    );
  }

  const catMeta: CategoryMeta[] = categories.map((c) => ({
    name: c.name,
    color: c.color,
  }));

  const totalAcumulado = periods.reduce((s, p) => s + p.totals.totalLocal, 0);
  const promedio = totalAcumulado / periods.length;
  const pendienteTotal = periods.reduce((s, p) => s + p.totals.pendienteLocal, 0);
  const mesMasAlto = periods.reduce(
    (max, p) => (p.totals.totalLocal > max.totals.totalLocal ? p : max),
    periods[0]
  );

  // `periods` viene del más reciente al más antiguo (sin filtro de año).
  const totalIngreso = periods.reduce((s, p) => s + p.incomeTotal, 0);
  const ahorroAcumulado = totalIngreso - totalAcumulado;
  const tasaAhorro = totalIngreso > 0 ? (ahorroAcumulado / totalIngreso) * 100 : 0;

  const [mesActual, mesAnterior] = periods;
  const variacionMensual =
    mesAnterior && mesAnterior.totals.totalLocal > 0
      ? ((mesActual.totals.totalLocal - mesAnterior.totals.totalLocal) / mesAnterior.totals.totalLocal) * 100
      : null;

  const categoryRanking = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      total: periods.reduce((s, p) => s + (p.totals.byCategory[c.id] ?? 0), 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxCategoryTotal = categoryRanking[0]?.total ?? 0;

  const chronological = [...periods].reverse();
  const monthly: MonthlyRow[] = chronological.map((p) => {
    const row: MonthlyRow = {
      label: `${p.label.split(' ')[0].slice(0, 3)} ${String(p.year).slice(2)}`,
      pagado: Math.round(p.totals.pagadoLocal),
      pendiente: Math.round(p.totals.pendienteLocal),
      ingreso: Math.round(p.incomeTotal),
      gasto: Math.round(p.totals.totalLocal),
    };
    for (const c of categories) {
      row[c.name] = Math.round(p.totals.byCategory[c.id] ?? 0);
    }
    return row;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analítica</h1>
        <p className="text-muted-foreground mt-1 text-base">
          Evolución de tus gastos, ingresos y ahorro a lo largo de los meses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total acumulado"
          value={<Money value={totalAcumulado} currency={localCurrency} locale={locale} animateOnMount />}
          sub={`${periods.length} mes(es)`}
          accent="primary"
          icon={<RiCoinsLine className="size-6" />}
        />
        <StatCard
          label="Promedio mensual"
          value={<Money value={promedio} currency={localCurrency} locale={locale} animateOnMount />}
          accent="sky"
          icon={<RiArrowRightUpLine className="size-6" />}
        />
        <StatCard
          label="Mes más alto"
          value={<Money value={mesMasAlto.totals.totalLocal} currency={localCurrency} locale={locale} animateOnMount />}
          sub={mesMasAlto.label}
          accent="amber"
          icon={<RiFireLine className="size-6" />}
        />
        <StatCard
          label="Pendiente total"
          value={<Money value={pendienteTotal} currency={localCurrency} locale={locale} animateOnMount />}
          accent="rose"
          icon={<RiCheckboxBlankCircleLine className="size-6" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Ingreso acumulado"
          value={<Money value={totalIngreso} currency={localCurrency} locale={locale} animateOnMount />}
          sub={`${periods.length} mes(es)`}
          accent="sky"
          icon={<RiWalletLine className="size-6" />}
        />
        <StatCard
          label="Tasa de ahorro"
          value={`${tasaAhorro >= 0 ? '' : '−'}${Math.abs(Math.round(tasaAhorro))}%`}
          sub={<Money value={ahorroAcumulado} currency={localCurrency} locale={locale} />}
          valueClass={ahorroAcumulado < 0 ? 'text-[var(--coral)]' : undefined}
          variant="forest"
          progress={Math.min(100, Math.max(0, tasaAhorro))}
          icon={<RiPercentLine className="size-6" />}
        />
        <StatCard
          label="Variación vs. mes anterior"
          value={
            variacionMensual === null
              ? '—'
              : `${variacionMensual > 0 ? '+' : variacionMensual < 0 ? '−' : ''}${Math.abs(Math.round(variacionMensual))}%`
          }
          valueClass={
            variacionMensual === null
              ? undefined
              : cn(variacionMensual > 0 ? 'text-[var(--coral)]' : variacionMensual < 0 ? 'text-[var(--forest)]' : undefined)
          }
          sub={variacionMensual === null ? 'Necesitás 2 meses para comparar' : mesAnterior.label}
          accent="amber"
          icon={
            variacionMensual === null || variacionMensual === 0 ? (
              <RiSubtractLine className="size-6" />
            ) : variacionMensual > 0 ? (
              <RiArrowUpSLine className="size-6" />
            ) : (
              <RiArrowDownSLine className="size-6" />
            )
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingreso vs gasto</CardTitle>
          <CardDescription>Cuánto entró y cuánto se usó cada mes ({localCurrency}).</CardDescription>
        </CardHeader>
        <CardContent>
          <IncomeExpenseChart data={monthly} currency={localCurrency} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gasto por categoría</CardTitle>
          <CardDescription>Apilado por mes ({localCurrency}).</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryAreaChart data={monthly} categories={catMeta} currency={localCurrency} locale={locale} />
        </CardContent>
      </Card>

      {categoryRanking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top categorías</CardTitle>
            <CardDescription>En qué se fue más, acumulado en todos tus meses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {categoryRanking.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${c.color}33`, color: c.color }}
                  >
                    <CategoryIcon name={c.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {formatMoney(c.total, localCurrency, locale)}
                      </p>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${maxCategoryTotal > 0 ? (c.total / maxCategoryTotal) * 100 : 0}%`,
                          backgroundColor: c.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pagado vs Pendiente</CardTitle>
          <CardDescription>Estado de los gastos por mes ({localCurrency}).</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusBarChart data={monthly} currency={localCurrency} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
