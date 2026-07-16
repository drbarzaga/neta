'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Plus,
  PiggyBank,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useConfirm } from '@/components/confirm-provider';
import { IconPicker } from '@/components/icon-picker';
import { CategoryIcon } from '@/components/category-icon';
import { DatePicker } from '@/components/date-picker';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { MONTHS_ES, todayISO } from '@/lib/dates';
import type { SavingsAccount, SavingsMovement } from '@/db';
import {
  createSavingsAccount,
  updateSavingsAccount,
  deleteSavingsAccount,
  addSavingsMovement,
  deleteSavingsMovement,
} from '../actions';

const round2 = (x: number) => Math.round(x * 100) / 100;

const HIDE_KEY = 'neta:hideSavings';
const MASK = '••••••';

/** Formatea un monto o lo enmascara si los saldos están ocultos. */
function money(hidden: boolean, n: number, currency: string, locale: string): string {
  return hidden ? MASK : formatMoney(n, currency, locale);
}

/** Etiqueta corta "Jul 26" a partir de "YYYY-MM". */
function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_ES[Number(m) - 1]?.slice(0, 3)} ${y.slice(2)}`;
}

/** Serie acumulada del total ahorrado por mes, convertido a moneda local. */
function buildChartData(
  accounts: SavingsAccount[],
  movements: SavingsMovement[],
  rate: number,
  localCurrency: string
): { label: string; total: number }[] {
  const curByAccount = new Map(accounts.map((a) => [a.id, a.currency]));
  const byMonth = new Map<string, number>();
  for (const m of movements) {
    const cur = curByAccount.get(m.accountId) ?? localCurrency;
    const local = cur === 'USD' ? m.amount * rate : m.amount;
    byMonth.set(m.date.slice(0, 7), (byMonth.get(m.date.slice(0, 7)) ?? 0) + local);
  }
  const keys = [...byMonth.keys()].sort();
  const out: { label: string; total: number }[] = [];
  let running = 0;
  for (const k of keys) {
    running += byMonth.get(k) ?? 0;
    out.push({ label: monthLabel(k), total: round2(running) });
  }
  return out;
}

export function SavingsClient({
  accounts,
  movements,
  rate,
  locale,
  localCurrency,
}: {
  accounts: SavingsAccount[];
  movements: SavingsMovement[];
  rate: number;
  locale: string;
  localCurrency: string;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; account: SavingsAccount | null }>({
    open: false,
    account: null,
  });
  const [sheet, setSheet] = useState<{
    open: boolean;
    account: SavingsAccount | null;
    kind: 'deposit' | 'withdraw';
  }>({ open: false, account: null, kind: 'deposit' });
  const [hidden, setHidden] = useState(false);

  // Preferencia de ocultar saldos (se lee tras montar para no romper hidratación).
  useEffect(() => {
    void (async () => {
      if (localStorage.getItem(HIDE_KEY) === '1') setHidden(true);
    })();
  }, []);

  function toggleHidden() {
    setHidden((h) => {
      const next = !h;
      try {
        localStorage.setItem(HIDE_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  }

  const toLocal = (amount: number, currency: string) =>
    currency === 'USD' ? amount * rate : amount;

  const totalLocal = accounts.reduce((s, a) => s + toLocal(a.balance, a.currency), 0);
  const totalUsd = rate > 0 ? totalLocal / rate : 0;

  // Evolución del total ahorrado (acumulado por mes, convertido a local).
  const chartData = useMemo(
    () => buildChartData(accounts, movements, rate, localCurrency),
    [accounts, movements, rate, localCurrency]
  );

  const chartConfig: ChartConfig = {
    total: { label: 'Total ahorrado', color: 'var(--primary)' },
  };

  const movementsByAccount = useMemo(() => {
    const map = new Map<string, SavingsMovement[]>();
    for (const m of movements) {
      if (!map.has(m.accountId)) map.set(m.accountId, []);
      map.get(m.accountId)!.push(m);
    }
    return map;
  }, [movements]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ahorros</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Lleva el control de tu plata guardada y cómo evoluciona.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleHidden}
            aria-label={hidden ? 'Mostrar saldos' : 'Ocultar saldos'}
            title={hidden ? 'Mostrar saldos' : 'Ocultar saldos'}
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button onClick={() => setDialog({ open: true, account: null })}>
            <Plus /> Nuevo apartado
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <PiggyBank className="size-7" />
            </span>
            <div>
              <p className="font-medium">Todavía no tienes apartados</p>
              <p className="text-muted-foreground text-sm">
                Crea uno por cada lugar donde guardas plata: caja de ahorro, USD,
                efectivo…
              </p>
            </div>
            <Button onClick={() => setDialog({ open: true, account: null })}>
              <Plus /> Crear apartado
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardContent className="flex flex-col justify-center gap-1 py-2">
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                    <Wallet className="size-5" />
                  </span>
                  <span className="text-muted-foreground text-sm">Total ahorrado</span>
                </div>
                <p className="text-3xl font-semibold tabular-nums">
                  {money(hidden, totalLocal, localCurrency, locale)}
                </p>
                {localCurrency !== 'USD' && (
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {money(hidden, totalUsd, 'USD', locale)} · {accounts.length} apartado(s)
                  </p>
                )}
              </CardContent>
            </Card>

            {chartData.length > 1 && (
              <Card className="sm:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Evolución del ahorro</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="max-h-[200px] w-full">
                    <AreaChart data={chartData} accessibilityLayer>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis hide domain={[0, 'dataMax']} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => (
                              <span className="font-medium tabular-nums">
                                {money(hidden, Number(value), localCurrency, locale)}
                              </span>
                            )}
                          />
                        }
                      />
                      <Area
                        dataKey="total"
                        type="monotone"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                locale={locale}
                rate={rate}
                hidden={hidden}
                onEdit={() => setDialog({ open: true, account: acc })}
                onMovement={(kind) => setSheet({ open: true, account: acc, kind })}
              />
            ))}
          </div>
        </>
      )}

      <AccountDialog
        key={dialog.account?.id ?? 'new'}
        open={dialog.open}
        account={dialog.account}
        localCurrency={localCurrency}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />

      {sheet.account && (
        <MovementSheet
          key={sheet.account.id}
          open={sheet.open}
          account={sheet.account}
          initialKind={sheet.kind}
          movements={movementsByAccount.get(sheet.account.id) ?? []}
          locale={locale}
          hidden={hidden}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        />
      )}
    </div>
  );
}

function AccountCard({
  account,
  locale,
  rate,
  hidden,
  onEdit,
  onMovement,
}: {
  account: SavingsAccount;
  locale: string;
  rate: number;
  hidden: boolean;
  onEdit: () => void;
  onMovement: (kind: 'deposit' | 'withdraw') => void;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar apartado',
      description: `Se eliminará "${account.name}" y todos sus movimientos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSavingsAccount(account.id);
      if (!res.ok) toast.error(res.error ?? 'Error al eliminar');
    });
  }

  const altUsd =
    account.currency !== 'USD' && rate > 0 ? account.balance / rate : null;

  return (
    <Card className={cn('flex flex-col', pending && 'opacity-60')}>
      <CardHeader className="flex items-start justify-between gap-2 space-y-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${account.color}22`, color: account.color }}
          >
            <CategoryIcon name={account.icon} className="size-5" />
          </span>
          <CardTitle className="truncate text-base">{account.name}</CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground -mr-2 -mt-1 size-8">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {money(hidden, account.balance, account.currency, locale)}
          </p>
          {altUsd !== null && (
            <p className="text-muted-foreground text-sm tabular-nums">
              {money(hidden, altUsd, 'USD', locale)}
            </p>
          )}
        </div>
        <div className="mt-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-emerald-700 dark:text-emerald-400"
            onClick={() => onMovement('deposit')}
          >
            <ArrowDownCircle className="size-4" /> Depositar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onMovement('withdraw')}
          >
            <ArrowUpCircle className="size-4" /> Retirar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountDialog({
  open,
  account,
  localCurrency,
  onOpenChange,
}: {
  open: boolean;
  account: SavingsAccount | null;
  localCurrency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(account?.name ?? '');
  const [icon, setIcon] = useState(account?.icon ?? 'piggy-bank');
  const [color, setColor] = useState(account?.color ?? '#10b981');
  const [currency, setCurrency] = useState(account?.currency ?? localCurrency);
  const [initial, setInitial] = useState('');

  const isEdit = !!account;

  function submit() {
    if (name.trim() === '') return;
    startTransition(async () => {
      const res = isEdit
        ? await updateSavingsAccount({ id: account!.id, name: name.trim(), icon, color, currency })
        : await createSavingsAccount({
            name: name.trim(),
            icon,
            color,
            currency,
            initialBalance: initial.trim() === '' ? 0 : Number(initial.replace(',', '.')),
          });
      if (!res.ok) {
        toast.error(res.error ?? 'Error al guardar');
        return;
      }
      toast.success(isEdit ? 'Apartado actualizado' : 'Apartado creado');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar apartado' : 'Nuevo apartado'}</DialogTitle>
          <DialogDescription>
            Un lugar donde guardas plata (caja de ahorro, USD, efectivo…).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="acc-name">Nombre</Label>
            <Input
              id="acc-name"
              value={name}
              placeholder="Ej. Caja de ahorro BROU"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="grid gap-1.5">
              <Label>Icono</Label>
              <IconPicker value={icon} color={color} onChange={setIcon} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acc-color">Color</Label>
              <Input
                id="acc-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1"
              />
            </div>
            <div className="grid flex-1 gap-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
                  {localCurrency !== 'USD' && <SelectItem value="USD">USD</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="grid gap-1.5">
              <Label htmlFor="acc-initial">Saldo inicial (opcional)</Label>
              <Input
                id="acc-initial"
                inputMode="decimal"
                value={initial}
                placeholder="0"
                onChange={(e) => setInitial(e.target.value)}
                className="tabular-nums"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || name.trim() === ''}>
            {pending ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementSheet({
  open,
  account,
  initialKind,
  movements,
  locale,
  hidden,
  onOpenChange,
}: {
  open: boolean;
  account: SavingsAccount;
  initialKind: 'deposit' | 'withdraw';
  movements: SavingsMovement[];
  locale: string;
  hidden: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<'deposit' | 'withdraw'>(initialKind);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState('');

  // Sincroniza el tipo cuando se abre desde Depositar/Retirar.
  const [prevKind, setPrevKind] = useState(initialKind);
  if (initialKind !== prevKind) {
    setPrevKind(initialKind);
    setKind(initialKind);
  }

  function submit() {
    const value = amount.trim() === '' ? 0 : Number(amount.replace(',', '.'));
    if (!(value > 0)) return;
    startTransition(async () => {
      const res = await addSavingsMovement({
        accountId: account.id,
        kind,
        amount: value,
        note: note.trim() || null,
        date,
      });
      if (!res.ok) {
        toast.error(res.error ?? 'Error al registrar');
        return;
      }
      toast.success(kind === 'deposit' ? 'Depósito registrado' : 'Retiro registrado');
      setAmount('');
      setNote('');
    });
  }

  async function removeMovement(id: string) {
    const ok = await confirm({
      title: 'Eliminar movimiento',
      description: 'Se revertirá su efecto en el saldo.',
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSavingsMovement({ id });
      if (!res.ok) toast.error(res.error ?? 'Error al eliminar');
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{account.name}</SheetTitle>
          <SheetDescription>
            Saldo: {money(hidden, account.balance, account.currency, locale)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={kind === 'deposit' ? 'default' : 'outline'}
              onClick={() => setKind('deposit')}
            >
              <ArrowDownCircle className="size-4" /> Depositar
            </Button>
            <Button
              type="button"
              variant={kind === 'withdraw' ? 'default' : 'outline'}
              onClick={() => setKind('withdraw')}
            >
              <ArrowUpCircle className="size-4" /> Retirar
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="mov-amount">Monto ({account.currency})</Label>
              <Input
                id="mov-amount"
                inputMode="decimal"
                value={amount}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha</Label>
              <DatePicker value={date} onChange={(iso) => setDate(iso ?? todayISO())} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mov-note">Nota (opcional)</Label>
            <Input
              id="mov-note"
              value={note}
              placeholder="Ej. sueldo, ahorro del mes…"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={pending || amount.trim() === ''}>
            {pending ? 'Guardando…' : kind === 'deposit' ? 'Registrar depósito' : 'Registrar retiro'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Movimientos
          </p>
          {movements.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Sin movimientos todavía.
            </p>
          ) : (
            <ul className="space-y-1">
              {movements.map((m) => {
                const positive = m.amount >= 0;
                return (
                  <li
                    key={m.id}
                    className="hover:bg-muted/60 group flex items-center gap-2 rounded-lg px-2 py-2"
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        positive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {positive ? (
                        <ArrowDownCircle className="size-4" />
                      ) : (
                        <ArrowUpCircle className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{m.note || (positive ? 'Depósito' : 'Retiro')}</p>
                      <p className="text-muted-foreground text-xs">{m.date}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-medium tabular-nums',
                        positive ? 'text-emerald-600 dark:text-emerald-400' : ''
                      )}
                    >
                      {hidden ? MASK : `${positive ? '+' : '−'}${formatMoney(Math.abs(m.amount), account.currency, locale)}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground size-7 shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={() => removeMovement(m.id)}
                      aria-label="Eliminar movimiento"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
