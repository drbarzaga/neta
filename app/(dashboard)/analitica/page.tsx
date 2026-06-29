import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart3, Coins, TrendingUp, Flame, CircleDashed } from 'lucide-react';
import { Money } from '@/components/money';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getPeriodsWithTotals } from '../meses/queries';
import { getCategories } from '../meses/[id]/queries';
import { StatCard } from '../_components/stat-card';
import {
  CategoryAreaChart,
  StatusBarChart,
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
          <BarChart3 className="text-muted-foreground size-12" />
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

  const chronological = [...periods].reverse();
  const monthly: MonthlyRow[] = chronological.map((p) => {
    const row: MonthlyRow = {
      label: `${p.label.split(' ')[0].slice(0, 3)} ${String(p.year).slice(2)}`,
      pagado: Math.round(p.totals.pagadoLocal),
      pendiente: Math.round(p.totals.pendienteLocal),
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
          Evolución de tus gastos a lo largo de los meses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total acumulado"
          value={<Money value={totalAcumulado} currency={localCurrency} locale={locale} animateOnMount />}
          sub={`${periods.length} mes(es)`}
          accent="primary"
          icon={<Coins className="size-6" />}
        />
        <StatCard
          label="Promedio mensual"
          value={<Money value={promedio} currency={localCurrency} locale={locale} animateOnMount />}
          accent="sky"
          icon={<TrendingUp className="size-6" />}
        />
        <StatCard
          label="Mes más alto"
          value={<Money value={mesMasAlto.totals.totalLocal} currency={localCurrency} locale={locale} animateOnMount />}
          sub={mesMasAlto.label}
          accent="amber"
          icon={<Flame className="size-6" />}
        />
        <StatCard
          label="Pendiente total"
          value={<Money value={pendienteTotal} currency={localCurrency} locale={locale} animateOnMount />}
          accent="rose"
          icon={<CircleDashed className="size-6" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gasto por categoría</CardTitle>
          <CardDescription>Apilado por mes ({localCurrency}).</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryAreaChart data={monthly} categories={catMeta} currency={localCurrency} locale={locale} />
        </CardContent>
      </Card>

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
