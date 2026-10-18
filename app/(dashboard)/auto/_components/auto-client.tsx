'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { RiAddLine, RiPencilLine, RiDeleteBinLine, RiMore2Line, RiCarLine, RiBankLine, RiWalletLine, RiCalendarCheckLine, RiArrowDownSLine, RiHistoryLine, RiCupLine } from '@remixicon/react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/components/confirm-provider';
import { useAnimations } from '@/components/animations-provider';
import { CategoryIcon } from '@/components/category-icon';
import { AskAdvisorButton } from '@/components/advisor/ask-advisor-button';
import { VehiclePhoto } from '@/components/vehicle-photo';
import { InstallmentGrid } from '@/components/installment-grid';
import { VehicleOnboarding } from './vehicle-onboarding';
import { DebtVsSavingsChart } from './debt-vs-savings-chart';
import { StatCard } from '../../_components/stat-card';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { MONTHS_ES, periodLabel } from '@/lib/dates';
import { fireConfetti } from '@/lib/confetti';
import type { VehicleExpense } from '@/db';
import type { VehicleWithExpenses } from '../queries';
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  contributeDownPayment,
  payOffLoan,
  addVehicleExpense,
  updateVehicleExpense,
  toggleVehicleExpensePaid,
  deleteVehicleExpense,
} from '../actions';
import { VEHICLE_EXPENSE_CATEGORIES, VEHICLE_STATUS_LABEL, LOAN_INSTALLMENT_CATEGORY } from '../schema';

const CATEGORY_ICON_KEY: Record<string, string> = {
  [LOAN_INSTALLMENT_CATEGORY]: 'landmark',
  Seguro: 'umbrella',
  Patente: 'receipt',
  Mantenimiento: 'hammer',
  Combustible: 'fuel',
  Otro: 'tag',
};

function nowParts() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function pctOf(saved: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (saved / target) * 100));
}

interface MonthGroup {
  month: number;
  year: number;
  items: VehicleExpense[];
  subtotalUsd: number;
  // Suma cruda de los montos, sin convertir. Solo tiene sentido cuando todo
  // el grupo comparte una moneda (las cuotas del préstamo, por ejemplo);
  // para "otros gastos" (que sí mezclan monedas) usar subtotalUsd.
  subtotalNative: number;
  allPaid: boolean;
  isPast: boolean;
}

interface CategoryTotal {
  category: string;
  paidUsd: number;
  pendingUsd: number;
  totalUsd: number;
}

/** Categorías de uso frecuente, para accesos rápidos al agregar un gasto. */
const QUICK_CATEGORIES = ['Seguro', 'Patente', 'Combustible', 'Mantenimiento'] as const;

/** Agrupa gastos por mes/año y calcula su subtotal en USD. */
function buildMonthGroups(
  expenses: VehicleExpense[],
  dollarRate: number,
  curMonth: number,
  curYear: number
): MonthGroup[] {
  const byKey = new Map<string, VehicleExpense[]>();
  for (const e of expenses) {
    const key = `${e.year}-${e.month}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }
  return [...byKey.entries()]
    .map(([, items]) => {
      const [first] = items;
      const isPast = first.year < curYear || (first.year === curYear && first.month < curMonth);
      return {
        month: first.month,
        year: first.year,
        items,
        subtotalUsd: items.reduce(
          (sum, e) => sum + (e.currency === 'USD' ? e.amount : dollarRate > 0 ? e.amount / dollarRate : e.amount),
          0
        ),
        subtotalNative: items.reduce((sum, e) => sum + e.amount, 0),
        allPaid: items.every((e) => e.paid),
        isPast,
      };
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
}

export function AutoClient({
  vehicles,
  locale,
  localCurrency,
  defaultDollarRate,
}: {
  vehicles: VehicleWithExpenses[];
  locale: string;
  localCurrency: string;
  defaultDollarRate: number;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; vehicle: VehicleWithExpenses | null }>({
    open: false,
    vehicle: null,
  });
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Autos</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Seguí el financiamiento y los gastos de tus vehículos, mes a mes.
          </p>
        </div>
        {vehicles.length > 0 && (
          <Button variant="outline" onClick={() => setDialog({ open: true, vehicle: null })}>
            <RiAddLine /> Otro vehículo
          </Button>
        )}
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <RiCarLine className="size-7" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">Todavía no configuraste tu auto</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Seguí el proceso guiado de financiación, seguro y matrícula, o cargalo a mano si
                ya tenés todos los números.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setOnboardingOpen(true)}>
                <RiAddLine /> Empezar onboarding guiado
              </Button>
              <Button variant="outline" onClick={() => setDialog({ open: true, vehicle: null })}>
                Configurar manualmente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {vehicles.map((v) => (
            <VehicleSection
              key={v.id}
              vehicle={v}
              locale={locale}
              localCurrency={localCurrency}
              onEdit={() => setDialog({ open: true, vehicle: v })}
            />
          ))}
        </div>
      )}

      <VehicleDialog
        key={dialog.vehicle?.id ?? 'new'}
        open={dialog.open}
        vehicle={dialog.vehicle}
        localCurrency={localCurrency}
        defaultDollarRate={defaultDollarRate}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
      />

      <VehicleOnboarding
        open={onboardingOpen}
        localCurrency={localCurrency}
        defaultDollarRate={defaultDollarRate}
        onOpenChange={setOnboardingOpen}
      />
    </div>
  );
}

function VehicleSection({
  vehicle,
  locale,
  localCurrency,
  onEdit,
}: {
  vehicle: VehicleWithExpenses;
  locale: string;
  localCurrency: string;
  onEdit: () => void;
}) {
  const confirm = useConfirm();
  const [expenseDialog, setExpenseDialog] = useState<{
    open: boolean;
    expense: VehicleExpense | null;
    month: number;
    year: number;
    category?: string;
  }>({ open: false, expense: null, ...nowParts() });
  const [showLoanHistory, setShowLoanHistory] = useState(false);
  const [showOtherHistory, setShowOtherHistory] = useState(false);

  const fmtUsd = (n: number) => formatMoney(n, 'USD', locale);
  // Precio, inicial y préstamo son todos en vehicle.currency (se elige al
  // crear/editar el vehículo). Los agregados cross-categoría (otros gastos,
  // totales) siguen en USD porque mezclan monedas distintas por gasto.
  const fmtVehicle = (n: number) => formatMoney(n, vehicle.currency, locale);
  // Las cuotas del préstamo pueden estar en una moneda distinta a la del
  // precio/préstamo (ej. préstamo en USD con cuotas fijadas en pesos).
  const fmtInstallment = (n: number) => formatMoney(n, vehicle.monthlyPaymentCurrency, locale);
  const { month: curMonth, year: curYear } = nowParts();

  const loanExpenses = useMemo(
    () => vehicle.expenses.filter((e) => e.category === LOAN_INSTALLMENT_CATEGORY),
    [vehicle.expenses]
  );
  const otherExpenses = useMemo(
    () => vehicle.expenses.filter((e) => e.category !== LOAN_INSTALLMENT_CATEGORY),
    [vehicle.expenses]
  );

  const loanGroups = useMemo(
    () => buildMonthGroups(loanExpenses, vehicle.dollarRate, curMonth, curYear),
    [loanExpenses, vehicle.dollarRate, curMonth, curYear]
  );
  const otherGroups = useMemo(
    () => buildMonthGroups(otherExpenses, vehicle.dollarRate, curMonth, curYear),
    [otherExpenses, vehicle.dollarRate, curMonth, curYear]
  );

  const loanPending = loanGroups.filter((g) => !(g.isPast && g.allPaid));
  const loanHistory = loanGroups.filter((g) => g.isPast && g.allPaid);
  const otherPending = otherGroups.filter((g) => !(g.isPast && g.allPaid));
  const otherHistory = otherGroups.filter((g) => g.isPast && g.allPaid);

  // Solo gastos que no son cuota del préstamo (ese ya tiene sus propias
  // tarjetas y su propia tab, separado a propósito del resto).
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const byCategory = new Map<string, CategoryTotal>();
    for (const e of otherExpenses) {
      const usd =
        e.currency === 'USD' ? e.amount : vehicle.dollarRate > 0 ? e.amount / vehicle.dollarRate : e.amount;
      const cur = byCategory.get(e.category) ?? {
        category: e.category,
        paidUsd: 0,
        pendingUsd: 0,
        totalUsd: 0,
      };
      if (e.paid) cur.paidUsd += usd;
      else cur.pendingUsd += usd;
      cur.totalUsd += usd;
      byCategory.set(e.category, cur);
    }
    return [...byCategory.values()].sort((a, b) => b.totalUsd - a.totalUsd);
  }, [otherExpenses, vehicle.dollarRate]);

  const pctDown = pctOf(vehicle.downPaymentSaved, vehicle.downPaymentTarget);
  const remainingDown = Math.max(0, vehicle.downPaymentTarget - vehicle.downPaymentSaved);
  const remainingInstallments = vehicle.totals.installmentsTotal - vehicle.totals.installmentsPaid;
  const pctInstallmentsPaid = pctOf(vehicle.totals.installmentsPaid, vehicle.totals.installmentsTotal);
  // Saldo del préstamo en vehicle.currency (no en USD): las cuotas se crean
  // todas en esa moneda, así que sumar el monto crudo es correcto y evita
  // mostrar un monto en una moneda distinta a la del resto de la tarjeta.
  const outstandingLoanNative = loanExpenses
    .filter((e) => !e.paid)
    .reduce((sum, e) => sum + e.amount, 0);

  // Confetti cuando el préstamo pasa de "con saldo" a "100% pagado" (ya sea
  // tildando la última cuota a mano o cancelando toda la deuda de una vez).
  // La ref arranca en el valor actual para no festejar de nuevo al recargar
  // la página con un préstamo que ya estaba saldado.
  const animations = useAnimations();
  const fullyPaid = vehicle.totals.installmentsTotal > 0 && remainingInstallments === 0;
  const wasFullyPaidRef = useRef(fullyPaid);
  useEffect(() => {
    if (fullyPaid && !wasFullyPaidRef.current && animations) {
      fireConfetti();
      toast.success('¡Préstamo saldado! 🎉');
    }
    wasFullyPaidRef.current = fullyPaid;
  }, [fullyPaid, animations]);

  async function payOffDebt() {
    const ok = await confirm({
      title: 'Cancelar deuda del préstamo',
      description: `Se van a marcar como pagadas las ${remainingInstallments} cuotas restantes (saldo de ${fmtInstallment(outstandingLoanNative)}). Usalo si liquidaste el préstamo de una sola vez.`,
      confirmText: 'Cancelar deuda',
    });
    if (!ok) return;
    const res = await payOffLoan({ id: vehicle.id });
    if (!res.ok) toast.error(res.error ?? 'No se pudo actualizar');
  }

  async function removeVehicle() {
    const ok = await confirm({
      title: 'Eliminar vehículo',
      description: `Se eliminará "${vehicle.name}" y todos sus gastos. No se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    const res = await deleteVehicle(vehicle.id);
    if (!res.ok) toast.error(res.error ?? 'No se pudo eliminar');
    else toast.success('Vehículo eliminado');
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
        <VehiclePhoto
          imageUrl={vehicle.imageUrl}
          color={vehicle.color}
          alt={vehicle.name}
          className="size-20 self-center sm:self-auto"
          iconClassName="size-8"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {vehicle.name}
              {vehicle.version && <span className="text-muted-foreground"> {vehicle.version}</span>}
              {vehicle.year && <span className="text-muted-foreground"> · {vehicle.year}</span>}
            </h2>
            <Badge variant="secondary">{VEHICLE_STATUS_LABEL[vehicle.status]}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Precio {fmtVehicle(vehicle.totalPrice)} · Inicial {fmtVehicle(vehicle.downPaymentTarget)} · Préstamo{' '}
            {fmtVehicle(vehicle.loanAmount)} en {vehicle.loanMonths} cuotas
          </p>
        </div>
        <AskAdvisorButton
          prompt={`¿Cómo voy con el préstamo y los gastos de mi ${vehicle.name}?`}
          label="Preguntarle al asesor"
          iconOnly
          className="self-start"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Acciones del vehículo" className="self-start">
              <RiMore2Line className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <RiPencilLine className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={removeVehicle}>
              <RiDeleteBinLine className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>

      <CardContent className="grid gap-4 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Precio total"
          value={fmtVehicle(vehicle.totalPrice)}
          valueClass="text-[28px]"
          icon={<RiCarLine className="size-5" />}
          accent="primary"
        />
        <StatCard
          label="Préstamo"
          value={fmtVehicle(vehicle.loanAmount)}
          valueClass="text-[28px]"
          sub={`${fmtInstallment(vehicle.monthlyPayment)} x ${vehicle.loanMonths} meses`}
          icon={<RiBankLine className="size-5" />}
          accent="sky"
        />
        <StatCard
          label="Cuotas pagadas"
          value={`${vehicle.totals.installmentsPaid}/${vehicle.totals.installmentsTotal}`}
          valueClass="text-[28px]"
          sub={`Saldo del préstamo: ${fmtInstallment(outstandingLoanNative)}`}
          icon={<RiCalendarCheckLine className="size-5" />}
          accent="emerald"
        />
        <StatCard
          label="Otros gastos"
          value={fmtUsd(vehicle.totals.otherPaidUsd + vehicle.totals.otherPendingUsd)}
          valueClass="text-[28px]"
          sub={`Pagado: ${fmtUsd(vehicle.totals.otherPaidUsd)} · Pendiente: ${fmtUsd(vehicle.totals.otherPendingUsd)}`}
          icon={<RiWalletLine className="size-5" />}
          accent="amber"
        />
      </CardContent>

      {outstandingLoanNative > 0 && vehicle.monthlyPayment > 0 && remainingInstallments > 0 && (
        <CardContent className="border-t pt-6">
          <DebtVsSavingsChart
            outstandingLoan={outstandingLoanNative}
            monthlyPayment={vehicle.monthlyPayment}
            remainingInstallments={remainingInstallments}
            currency={vehicle.monthlyPaymentCurrency}
            dollarRate={vehicle.dollarRate}
            localCurrency={localCurrency}
            locale={locale}
          />
        </CardContent>
      )}

      <CardContent className="border-t pt-6">
        <DownPaymentCard
          vehicle={vehicle}
          fmt={fmtVehicle}
          pct={pctDown}
          remaining={remainingDown}
        />
      </CardContent>

      {categoryTotals.length > 0 && (
        <CardContent className="border-t pt-6">
          <h3 className="mb-1 font-medium">Otros gastos por categoría</h3>
          <p className="text-muted-foreground mb-3 text-xs">
            Sin contar las cuotas del préstamo, que tienen su propia sección más abajo.
          </p>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryTotals.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CategoryIcon name={CATEGORY_ICON_KEY[c.category] ?? 'tag'} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.category}</p>
                  {c.pendingUsd > 0 && (
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {fmtUsd(c.paidUsd)} pagado · {fmtUsd(c.pendingUsd)} pendiente
                    </p>
                  )}
                </div>
                <span className="text-sm font-medium tabular-nums">{fmtUsd(c.totalUsd)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      <CardContent className="border-t pt-6">
        <Tabs defaultValue="cuotas">
          <TabsList>
            <TabsTrigger value="cuotas">Cuotas del préstamo</TabsTrigger>
            <TabsTrigger value="gastos">Gastos mes a mes</TabsTrigger>
          </TabsList>

          <TabsContent value="cuotas" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {fullyPaid ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--forest)]">
                  <RiCupLine className="size-4" /> Préstamo saldado
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {vehicle.loanMonths > 0
                    ? `${fmtInstallment(vehicle.monthlyPayment)} por mes, ${vehicle.loanMonths} cuotas en total.`
                    : 'Este vehículo no tiene un préstamo cargado.'}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {remainingInstallments > 0 && (
                  <Button size="sm" variant="outline" onClick={payOffDebt}>
                    <RiCupLine className="size-3.5" /> Cancelar deuda
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setExpenseDialog({
                      open: true,
                      expense: null,
                      month: curMonth,
                      year: curYear,
                      category: LOAN_INSTALLMENT_CATEGORY,
                    })
                  }
                >
                  <RiAddLine className="size-3.5" /> Agregar cuota
                </Button>
              </div>
            </div>
            {vehicle.totals.installmentsTotal > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-[var(--forest)] transition-all"
                    style={{ width: `${pctInstallmentsPaid}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {Math.round(pctInstallmentsPaid)}% pagado · {vehicle.totals.installmentsPaid}/
                  {vehicle.totals.installmentsTotal} cuotas
                </p>
              </div>
            )}
            <InstallmentGrid paid={loanExpenses.map((e) => e.paid)} />
            <ExpenseMonthList
              pending={loanPending}
              history={loanHistory}
              vehicle={vehicle}
              locale={locale}
              curMonth={curMonth}
              curYear={curYear}
              fmtSubtotal={(g) => fmtInstallment(g.subtotalNative)}
              showHistory={showLoanHistory}
              onShowHistoryChange={setShowLoanHistory}
              emptyMessage="Todavía no hay cuotas cargadas para este vehículo."
              onAddToMonth={(month, year) =>
                setExpenseDialog({ open: true, expense: null, month, year, category: LOAN_INSTALLMENT_CATEGORY })
              }
              onEditExpense={(e) =>
                setExpenseDialog({ open: true, expense: e, month: e.month, year: e.year })
              }
            />
          </TabsContent>

          <TabsContent value="gastos" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Seguro, patente, service, combustible y cualquier otro gasto del auto.
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CATEGORIES.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExpenseDialog({ open: true, expense: null, month: curMonth, year: curYear, category: c })
                    }
                  >
                    <RiAddLine className="size-3.5" /> {c}
                  </Button>
                ))}
                <Button
                  size="sm"
                  onClick={() =>
                    setExpenseDialog({ open: true, expense: null, month: curMonth, year: curYear })
                  }
                >
                  <RiAddLine className="size-4" /> Agregar gasto
                </Button>
              </div>
            </div>
            <ExpenseMonthList
              pending={otherPending}
              history={otherHistory}
              vehicle={vehicle}
              locale={locale}
              curMonth={curMonth}
              curYear={curYear}
              fmtSubtotal={(g) => fmtUsd(g.subtotalUsd)}
              showHistory={showOtherHistory}
              onShowHistoryChange={setShowOtherHistory}
              emptyMessage="Todavía no cargaste otros gastos para este vehículo."
              onAddToMonth={(month, year) =>
                setExpenseDialog({ open: true, expense: null, month, year })
              }
              onEditExpense={(e) =>
                setExpenseDialog({ open: true, expense: e, month: e.month, year: e.year })
              }
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <VehicleExpenseDialog
        key={
          expenseDialog.expense?.id ??
          `${expenseDialog.month}-${expenseDialog.year}-${expenseDialog.category ?? ''}`
        }
        open={expenseDialog.open}
        vehicleId={vehicle.id}
        vehicleCurrency={vehicle.currency}
        localCurrency={localCurrency}
        defaultCurrency={
          expenseDialog.category === LOAN_INSTALLMENT_CATEGORY
            ? vehicle.monthlyPaymentCurrency
            : undefined
        }
        month={expenseDialog.month}
        year={expenseDialog.year}
        defaultCategory={expenseDialog.category}
        expense={expenseDialog.expense}
        onOpenChange={(o) => setExpenseDialog((d) => ({ ...d, open: o }))}
      />
    </Card>
  );
}

function DownPaymentCard({
  vehicle,
  fmt,
  pct,
  remaining,
}: {
  vehicle: VehicleWithExpenses;
  fmt: (n: number) => string;
  pct: number;
  remaining: number;
}) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');

  function addAmount() {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value === 0) return;
    setAmount('');
    startTransition(async () => {
      const res = await contributeDownPayment({ id: vehicle.id, amount: value });
      if (!res.ok) toast.error(res.error ?? 'No se pudo actualizar');
      else toast.success('Ahorro actualizado');
    });
  }

  return (
    <div className={cn('flex flex-col gap-3', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Inicial</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">{fmt(vehicle.downPaymentSaved)}</span>
          <span className="text-muted-foreground text-sm tabular-nums">
            de {fmt(vehicle.downPaymentTarget)}
          </span>
        </div>
      </div>
      <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: vehicle.color }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs tabular-nums">
          {Math.round(pct)}%{remaining > 0 ? ` · faltan ${fmt(remaining)}` : ' · ¡completo!'}
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAmount();
              }
            }}
            className="h-8 w-28 tabular-nums"
          />
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            onClick={addAmount}
            disabled={pending || amount.trim() === ''}
          >
            <RiAddLine className="size-3.5" /> Abonar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExpenseMonthList({
  pending,
  history,
  vehicle,
  locale,
  curMonth,
  curYear,
  fmtSubtotal,
  showHistory,
  onShowHistoryChange,
  emptyMessage,
  onAddToMonth,
  onEditExpense,
}: {
  pending: MonthGroup[];
  history: MonthGroup[];
  vehicle: VehicleWithExpenses;
  locale: string;
  curMonth: number;
  curYear: number;
  fmtSubtotal: (g: MonthGroup) => string;
  showHistory: boolean;
  onShowHistoryChange: (open: boolean) => void;
  emptyMessage: string;
  onAddToMonth: (month: number, year: number) => void;
  onEditExpense: (e: VehicleExpense) => void;
}) {
  if (pending.length === 0 && history.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {pending.map((g) => (
        <MonthCard
          key={`${g.year}-${g.month}`}
          group={g}
          vehicle={vehicle}
          locale={locale}
          isCurrent={g.month === curMonth && g.year === curYear}
          fmtSubtotal={fmtSubtotal}
          onAdd={() => onAddToMonth(g.month, g.year)}
          onEdit={onEditExpense}
        />
      ))}

      {history.length > 0 && (
        <Collapsible open={showHistory} onOpenChange={onShowHistoryChange}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground w-fit gap-1.5">
              <RiHistoryLine className="size-4" />
              {showHistory ? 'Ocultar' : 'Ver'} histórico de meses pagados ({history.length})
              <RiArrowDownSLine className={cn('size-3.5 transition-transform', showHistory && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-3 pt-3">
            {history.map((g) => (
              <MonthCard
                key={`${g.year}-${g.month}`}
                group={g}
                vehicle={vehicle}
                locale={locale}
                isCurrent={false}
                fmtSubtotal={fmtSubtotal}
                onAdd={() => onAddToMonth(g.month, g.year)}
                onEdit={onEditExpense}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function MonthCard({
  group,
  vehicle,
  locale,
  isCurrent,
  fmtSubtotal,
  onAdd,
  onEdit,
}: {
  group: MonthGroup;
  vehicle: VehicleWithExpenses;
  locale: string;
  isCurrent: boolean;
  fmtSubtotal: (g: MonthGroup) => string;
  onAdd: () => void;
  onEdit: (e: VehicleExpense) => void;
}) {
  const overdue = group.isPast && !group.allPaid;

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{periodLabel(group.month, group.year)}</p>
          {isCurrent && <Badge>Este mes</Badge>}
          {overdue && <Badge variant="destructive">Atrasado</Badge>}
          {!overdue && !isCurrent && group.allPaid && (
            <Badge variant="secondary">Pagado</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums">{fmtSubtotal(group)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7"
            aria-label="Agregar gasto a este mes"
            onClick={onAdd}
          >
            <RiAddLine className="size-4" />
          </Button>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5 px-4 py-3">
        {group.items.map((e) => (
          <VehicleExpenseRow
            key={e.id}
            expense={e}
            locale={locale}
            dollarRate={vehicle.dollarRate}
            onEdit={() => onEdit(e)}
          />
        ))}
      </ul>
    </div>
  );
}

function VehicleExpenseRow({
  expense,
  locale,
  dollarRate,
  onEdit,
}: {
  expense: VehicleExpense;
  locale: string;
  dollarRate: number;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const fmt = (n: number) => formatMoney(n, expense.currency, locale);
  const usdEquivalent =
    expense.currency !== 'USD' && dollarRate > 0 ? expense.amount / dollarRate : null;

  function togglePaid(checked: boolean) {
    startTransition(async () => {
      const res = await toggleVehicleExpensePaid({ id: expense.id, paid: checked });
      if (!res.ok) toast.error(res.error ?? 'No se pudo actualizar');
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar gasto',
      description: `Se eliminará "${expense.concept}".`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteVehicleExpense({ id: expense.id });
      if (!res.ok) toast.error(res.error ?? 'No se pudo eliminar');
      else toast.success('Gasto eliminado');
    });
  }

  return (
    <li className={cn('flex items-center gap-3', pending && 'opacity-60')}>
      <Checkbox
        checked={expense.paid}
        disabled={pending}
        onCheckedChange={(v) => togglePaid(v === true)}
        aria-label={expense.paid ? 'Marcar como pendiente' : 'Marcar como pagado'}
      />
      <span className="text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <CategoryIcon name={CATEGORY_ICON_KEY[expense.category] ?? 'tag'} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', expense.paid && 'text-muted-foreground line-through')}>
          {expense.concept}
        </p>
        <p className="text-muted-foreground text-xs">{expense.category}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums">{fmt(expense.amount)}</p>
        {usdEquivalent !== null && (
          <p className="text-muted-foreground text-xs tabular-nums">
            ≈ {formatMoney(usdEquivalent, 'USD', locale)}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7 shrink-0"
            aria-label="Acciones del gasto"
            disabled={pending}
          >
            <RiMore2Line className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}>
            <RiPencilLine className="size-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={remove}>
            <RiDeleteBinLine className="size-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function MonthYearSelect({
  month,
  year,
  onMonthChange,
  onYearChange,
}: {
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}) {
  const { year: curYear } = nowParts();
  const years = Array.from({ length: 10 }, (_, i) => curYear - 2 + i);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-1.5">
        <Label>Mes</Label>
        <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS_ES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Año</Label>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function VehicleExpenseDialog({
  open,
  vehicleId,
  vehicleCurrency,
  localCurrency,
  defaultCurrency,
  month,
  year,
  defaultCategory,
  expense,
  onOpenChange,
}: {
  open: boolean;
  vehicleId: string;
  vehicleCurrency: string;
  localCurrency: string;
  defaultCurrency?: string;
  month: number;
  year: number;
  defaultCategory?: string;
  expense: VehicleExpense | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(expense?.category ?? defaultCategory ?? 'Otro');
  const [concept, setConcept] = useState(expense?.concept ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency ?? localCurrency);
  const [expMonth, setExpMonth] = useState(expense?.month ?? month);
  const [expYear, setExpYear] = useState(expense?.year ?? year);
  const [paid, setPaid] = useState(expense?.paid ?? false);

  const isEdit = expense !== null;
  const isLoanInstallment = expense?.category === LOAN_INSTALLMENT_CATEGORY;

  function submit() {
    if (!concept.trim()) {
      toast.error('Ponle un concepto al gasto');
      return;
    }
    const amountNum = amount === '' ? 0 : Number(amount);
    if (Number.isNaN(amountNum)) {
      toast.error('El monto debe ser un número');
      return;
    }
    const payload = {
      category: category.trim() || 'Otro',
      concept: concept.trim(),
      amount: amountNum,
      currency,
      month: expMonth,
      year: expYear,
      paid,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateVehicleExpense({ id: expense.id, ...payload })
        : await addVehicleExpense({ vehicleId, ...payload });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Gasto actualizado' : 'Gasto agregado');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          <DialogDescription>
            {isLoanInstallment
              ? 'Esta cuota del préstamo se generó automáticamente; podés ajustar su monto o marcarla como pagada.'
              : 'Registra un gasto del auto (seguro, patente, mantenimiento, combustible…).'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ve-concept">Concepto</Label>
            <Input
              id="ve-concept"
              value={concept}
              placeholder="Ej. Seguro anual"
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ve-category">Categoría</Label>
            <Input
              id="ve-category"
              list="vehicle-expense-categories"
              value={category}
              placeholder="Ej. Seguro"
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="vehicle-expense-categories">
              {VEHICLE_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ve-amount">Monto</Label>
              <Input
                id="ve-amount"
                inputMode="decimal"
                value={amount}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ve-currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="ve-currency" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
                  {localCurrency !== vehicleCurrency && (
                    <SelectItem value={vehicleCurrency}>{vehicleCurrency}</SelectItem>
                  )}
                  {localCurrency !== 'USD' && vehicleCurrency !== 'USD' && (
                    <SelectItem value="USD">USD</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <MonthYearSelect
            month={expMonth}
            year={expYear}
            onMonthChange={setExpMonth}
            onYearChange={setExpYear}
          />

          <div className="flex items-center gap-2">
            <Checkbox id="ve-paid" checked={paid} onCheckedChange={(v) => setPaid(v === true)} />
            <Label htmlFor="ve-paid" className="font-normal">
              Ya está pagado
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Agregar gasto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VehicleDialog({
  open,
  vehicle,
  localCurrency,
  defaultDollarRate,
  onOpenChange,
}: {
  open: boolean;
  vehicle: VehicleWithExpenses | null;
  localCurrency: string;
  defaultDollarRate: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { month: curMonth, year: curYear } = nowParts();

  const [name, setName] = useState(vehicle?.name ?? 'VW Tera');
  const [version, setVersion] = useState(vehicle?.version ?? 'High');
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '');
  const [imageUrl, setImageUrl] = useState(vehicle?.imageUrl ?? '');
  const [totalPrice, setTotalPrice] = useState(String(vehicle?.totalPrice ?? 26990));
  const [downPaymentTarget, setDownPaymentTarget] = useState(
    String(vehicle?.downPaymentTarget ?? 20000)
  );
  const [downPaymentSaved, setDownPaymentSaved] = useState(
    String(vehicle?.downPaymentSaved ?? 16000)
  );
  const [loanAmount, setLoanAmount] = useState(String(vehicle?.loanAmount ?? 6990));
  const [loanMonths, setLoanMonths] = useState(String(vehicle?.loanMonths ?? 24));
  const [loanStartMonth, setLoanStartMonth] = useState(vehicle?.loanStartMonth ?? curMonth);
  const [loanStartYear, setLoanStartYear] = useState(vehicle?.loanStartYear ?? curYear);
  const [monthlyPayment, setMonthlyPayment] = useState(
    String(vehicle?.monthlyPayment ?? 291.25)
  );
  const [currency, setCurrency] = useState(vehicle?.currency ?? 'USD');
  const [monthlyPaymentCurrency, setMonthlyPaymentCurrency] = useState(
    vehicle?.monthlyPaymentCurrency ?? 'USD'
  );
  const [dollarRate, setDollarRate] = useState(
    vehicle ? String(vehicle.dollarRate) : defaultDollarRate ? String(defaultDollarRate) : ''
  );
  const [color, setColor] = useState(vehicle?.color ?? '#2563eb');

  const isEdit = vehicle !== null;
  // Año modelo: los autos 0km suelen venderse con el año siguiente al
  // calendario, y el rango no necesita ir más atrás de unas décadas.
  const vehicleYears = Array.from({ length: curYear + 1 - 1990 + 1 }, (_, i) => curYear + 1 - i);

  function submit() {
    if (!name.trim()) {
      toast.error('Ponle un nombre al vehículo');
      return;
    }
    const nums = {
      totalPrice: totalPrice === '' ? 0 : Number(totalPrice),
      downPaymentTarget: downPaymentTarget === '' ? 0 : Number(downPaymentTarget),
      downPaymentSaved: downPaymentSaved === '' ? 0 : Number(downPaymentSaved),
      loanAmount: loanAmount === '' ? 0 : Number(loanAmount),
      loanMonths: loanMonths === '' ? 0 : Number(loanMonths),
      monthlyPayment: monthlyPayment === '' ? 0 : Number(monthlyPayment),
      dollarRate: dollarRate === '' ? 0 : Number(dollarRate),
    };
    if (Object.values(nums).some((n) => Number.isNaN(n))) {
      toast.error('Los montos deben ser números');
      return;
    }
    const payload = {
      name: name.trim(),
      version: version.trim() || null,
      year: year === '' ? null : Number(year),
      imageUrl: imageUrl.trim() || null,
      currency,
      monthlyPaymentCurrency,
      color,
      loanStartMonth,
      loanStartYear,
      ...nums,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateVehicle({ id: vehicle.id, ...payload })
        : await createVehicle(payload);
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Vehículo actualizado' : 'Vehículo creado');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar vehículo' : 'Configurar mi auto'}</DialogTitle>
          <DialogDescription>
            Precio, inicial y financiamiento. Las cuotas se generan solas al crearlo.
          </DialogDescription>
        </DialogHeader>

        <div className="sm:columns-2 sm:gap-x-10 sm:[column-rule:1px_solid_var(--border)]">
          <div className="mb-6 grid gap-4 break-inside-avoid">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Datos generales
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <div className="grid gap-1.5">
                <Label htmlFor="v-name">Nombre</Label>
                <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-version">Versión</Label>
                <Input
                  id="v-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-year">Año</Label>
                <Select
                  value={year || 'none'}
                  onValueChange={(v) => setYear(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="v-year" className="w-full">
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {vehicleYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="v-image">Foto (URL, opcional)</Label>
              <Input
                id="v-image"
                value={imageUrl}
                placeholder="https://…"
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Pegá el link de una foto real del auto. Si la dejás vacía se muestra un boceto
                genérico.
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 break-inside-avoid">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Precio e inicial
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="v-price">Precio total</Label>
                <Input
                  id="v-price"
                  inputMode="decimal"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-currency">Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="v-currency" className="w-full sm:w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    {localCurrency !== 'USD' && (
                      <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
              Se aplica al precio y el inicial. El financiamiento y los demás gastos pueden tener su
              propia moneda cada uno.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="v-down-target">Inicial objetivo ({currency})</Label>
                <Input
                  id="v-down-target"
                  inputMode="decimal"
                  value={downPaymentTarget}
                  onChange={(e) => setDownPaymentTarget(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-down-saved">Ya ahorrado ({currency})</Label>
                <Input
                  id="v-down-saved"
                  inputMode="decimal"
                  value={downPaymentSaved}
                  onChange={(e) => setDownPaymentSaved(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 break-inside-avoid">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Financiamiento
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="v-loan-amount">Financiamiento ({currency})</Label>
                <Input
                  id="v-loan-amount"
                  inputMode="decimal"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-loan-months">Cantidad de cuotas</Label>
                <Input
                  id="v-loan-months"
                  inputMode="numeric"
                  value={loanMonths}
                  onChange={(e) => setLoanMonths(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="v-monthly-payment">Cuota mensual</Label>
                <Input
                  id="v-monthly-payment"
                  inputMode="decimal"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-monthly-payment-currency">Moneda de la cuota</Label>
                <Select value={monthlyPaymentCurrency} onValueChange={setMonthlyPaymentCurrency}>
                  <SelectTrigger id="v-monthly-payment-currency" className="w-full sm:w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    {localCurrency !== 'USD' && (
                      <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
              Puede tener su propia moneda, distinta a la del precio o el financiamiento.
            </p>
          </div>

          {!isEdit && (
            <div className="mb-6 grid gap-4 break-inside-avoid">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Primera cuota
              </h3>
              <MonthYearSelect
                month={loanStartMonth}
                year={loanStartYear}
                onMonthChange={setLoanStartMonth}
                onYearChange={setLoanStartYear}
              />
              {Number(loanAmount) > 0 && Number(loanMonths) > 0 && (
                <p className="text-muted-foreground -mt-2 text-xs">
                  Se van a crear {loanMonths} cuotas de{' '}
                  {formatMoney(Number(monthlyPayment) || 0, monthlyPaymentCurrency)} desde{' '}
                  {MONTHS_ES[loanStartMonth - 1]} de {loanStartYear}.
                </p>
              )}
            </div>
          )}

          <div className="mb-6 grid gap-4 break-inside-avoid">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Otros ajustes
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="v-dollar-rate">
                  Cotización USD → {localCurrency} (para gastos en {localCurrency})
                </Label>
                <Input
                  id="v-dollar-rate"
                  inputMode="decimal"
                  value={dollarRate}
                  onChange={(e) => setDollarRate(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-color">Color</Label>
                <Input
                  id="v-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-16 p-1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Crear vehículo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
