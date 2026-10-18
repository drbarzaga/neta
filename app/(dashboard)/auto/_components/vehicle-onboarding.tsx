'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark,
  ShieldCheck,
  FileCheck2,
  ShieldAlert,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { MONTHS_ES } from '@/lib/dates';
import { completeVehicleOnboarding } from '../actions';

const STEPS = [
  { title: 'Financiación', icon: Landmark },
  { title: 'Seguro', icon: ShieldCheck },
  { title: 'Matrícula', icon: FileCheck2 },
  { title: 'Pack de seguridad', icon: ShieldAlert },
  { title: 'Confirmación', icon: PartyPopper },
] as const;

function nowParts() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

interface FormState {
  name: string;
  version: string;
  downPaymentGiven: string;
  loanAmount: string;
  loanMonths: string;
  monthlyPayment: string;
  monthlyPaymentCurrency: string;
  loanStartMonth: number;
  loanStartYear: number;
  dollarRate: string;
  signatureConfirmed: boolean;
  insuranceMonthly: string;
  localCurrency: string;
  autoChargeConfirmed: boolean;
  registrationFee: string;
  patenteProportional: string;
  plateConfirmed: boolean;
  wantsSecurityPack: boolean | null;
  securityPackAmount: string;
  securityPackInstallments: string;
}

function initialState(localCurrency: string, defaultDollarRate: number): FormState {
  const { month, year } = nowParts();
  return {
    name: 'Volkswagen Tera',
    version: 'High',
    downPaymentGiven: '20000',
    loanAmount: '6990',
    loanMonths: '24',
    monthlyPayment: '14800',
    monthlyPaymentCurrency: localCurrency,
    loanStartMonth: month,
    loanStartYear: year,
    dollarRate: defaultDollarRate ? String(defaultDollarRate) : '42',
    signatureConfirmed: false,
    insuranceMonthly: '11950',
    localCurrency,
    autoChargeConfirmed: false,
    registrationFee: '5101',
    patenteProportional: '6300',
    plateConfirmed: false,
    wantsSecurityPack: null,
    securityPackAmount: '1000',
    securityPackInstallments: '6',
  };
}

const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

export function VehicleOnboarding({
  open,
  localCurrency,
  defaultDollarRate,
  onOpenChange,
}: {
  open: boolean;
  localCurrency: string;
  defaultDollarRate: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(() => initialState(localCurrency, defaultDollarRate));
  const [pending, startTransition] = useTransition();

  function patch(fields: Partial<FormState>) {
    setForm((f) => ({ ...f, ...fields }));
  }

  function reset() {
    setStep(0);
    setDirection(1);
    setForm(initialState(localCurrency, defaultDollarRate));
  }

  function go(to: number) {
    if (to < 0 || to >= STEPS.length) return;
    setDirection(to > step ? 1 : -1);
    setStep(to);
  }

  function canAdvance() {
    if (step === 0) {
      return (
        form.name.trim() !== '' &&
        num(form.loanAmount) > 0 &&
        num(form.loanMonths) > 0 &&
        form.signatureConfirmed
      );
    }
    if (step === 1) return form.autoChargeConfirmed;
    if (step === 2) return form.plateConfirmed;
    if (step === 3) return form.wantsSecurityPack !== null;
    return true;
  }

  function submit() {
    const payload = {
      name: form.name.trim(),
      version: form.version.trim() || null,
      downPaymentGiven: num(form.downPaymentGiven),
      loanAmount: num(form.loanAmount),
      loanMonths: Math.max(1, Math.round(num(form.loanMonths))),
      monthlyPayment: num(form.monthlyPayment),
      monthlyPaymentCurrency: form.monthlyPaymentCurrency,
      loanStartMonth: form.loanStartMonth,
      loanStartYear: form.loanStartYear,
      dollarRate: num(form.dollarRate),
      insuranceMonthly: num(form.insuranceMonthly),
      localCurrency: form.localCurrency,
      registrationFee: num(form.registrationFee),
      patenteProportional: num(form.patenteProportional),
      wantsSecurityPack: form.wantsSecurityPack === true,
      securityPackAmount: num(form.securityPackAmount),
      securityPackInstallments: Math.max(1, Math.round(num(form.securityPackInstallments)) || 6),
    };
    startTransition(async () => {
      const res = await completeVehicleOnboarding(payload);
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo completar el onboarding');
        return;
      }
      toast.success('¡Vehículo configurado! Bienvenido al panel de control.');
      onOpenChange(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <OnboardingProgress step={step} onStepClick={(i) => i < step && go(i)} />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {step === 0 && <StepFinancing form={form} patch={patch} localCurrency={localCurrency} />}
              {step === 1 && <StepInsurance form={form} patch={patch} />}
              {step === 2 && <StepRegistration form={form} patch={patch} />}
              {step === 3 && <StepSecurityPack form={form} patch={patch} />}
              {step === 4 && <StepConfirmation form={form} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || pending}>
            <ChevronLeft className="size-4" /> Atrás
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => go(step + 1)} disabled={!canAdvance() || pending}>
              Continuar <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              <Sparkles className="size-4" /> Finalizar onboarding
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingProgress({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <div className="border-b px-6 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? 'done' : i === step ? 'current' : 'upcoming';
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => onStepClick(i)}
              disabled={i >= step}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 text-center',
                i >= step && 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border transition-colors',
                  state === 'done' && 'border-primary bg-primary text-primary-foreground',
                  state === 'current' && 'border-primary text-primary',
                  state === 'upcoming' && 'text-muted-foreground border-border'
                )}
              >
                {state === 'done' ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span
                className={cn(
                  'hidden text-[11px] font-medium sm:block',
                  state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {s.title}
              </span>
            </button>
          );
        })}
      </div>
      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
        <motion.div
          className="bg-primary h-full rounded-full"
          animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </div>
  );
}

function StepFinancing({
  form,
  patch,
  localCurrency,
}: {
  form: FormState;
  patch: (f: Partial<FormState>) => void;
  localCurrency: string;
}) {
  return (
    <div>
      <StepHeader
        title="Datos de la financiación"
        description="Lo que acordaste con la automotora. Podés editar todos los montos."
      />
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-name">Vehículo</Label>
            <Input id="ob-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-version">Versión</Label>
            <Input
              id="ob-version"
              value={form.version}
              onChange={(e) => patch({ version: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-down">Inicial entregado (US$)</Label>
            <Input
              id="ob-down"
              inputMode="decimal"
              value={form.downPaymentGiven}
              onChange={(e) => patch({ downPaymentGiven: e.target.value })}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-loan">Saldo a financiar (US$)</Label>
            <Input
              id="ob-loan"
              inputMode="decimal"
              value={form.loanAmount}
              onChange={(e) => patch({ loanAmount: e.target.value })}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-months">Plazo (cuotas)</Label>
            <Input
              id="ob-months"
              inputMode="numeric"
              value={form.loanMonths}
              onChange={(e) => patch({ loanMonths: e.target.value })}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-cuota">Valor de cuota mensual</Label>
            <Input
              id="ob-cuota"
              inputMode="decimal"
              value={form.monthlyPayment}
              onChange={(e) => patch({ monthlyPayment: e.target.value })}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-cuota-currency">Moneda</Label>
            <Select
              value={form.monthlyPaymentCurrency}
              onValueChange={(v) => patch({ monthlyPaymentCurrency: v })}
            >
              <SelectTrigger id="ob-cuota-currency" className="w-full sm:w-24">
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

        <div className="bg-muted/50 flex items-start gap-3 rounded-xl border p-4">
          <Checkbox
            id="ob-signature"
            checked={form.signatureConfirmed}
            onCheckedChange={(v) => patch({ signatureConfirmed: v === true })}
            className="mt-0.5"
          />
          <Label htmlFor="ob-signature" className="text-sm font-normal">
            Confirmo la firma del crédito y el retiro del auto con Permiso Temporal de Circulación.{' '}
            <span className="text-muted-foreground">Costo en caja: $0.</span>
          </Label>
        </div>
      </div>
    </div>
  );
}

function StepInsurance({
  form,
  patch,
}: {
  form: FormState;
  patch: (f: Partial<FormState>) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Activación del seguro"
        description="Convenio de la automotora con BSE, con descuento aplicado."
      />
      <div className="grid gap-4">
        <div className="relative rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
          <Badge className="absolute -top-2.5 right-4">Convenio automotora aplicado</Badge>
          <p className="font-medium">Plan Global BSE</p>
          <p className="text-muted-foreground mt-1 text-sm">Promo 3x2 · cobertura todo riesgo</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-insurance">Cuota mensual bonificada</Label>
            <Input
              id="ob-insurance"
              inputMode="decimal"
              value={form.insuranceMonthly}
              onChange={(e) => patch({ insuranceMonthly: e.target.value })}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Moneda</Label>
            <div className="flex h-9 w-full items-center rounded-md border px-3 text-sm sm:w-24">
              {form.localCurrency}
            </div>
          </div>
        </div>

        <div className="bg-muted/50 flex items-start gap-3 rounded-xl border p-4">
          <Checkbox
            id="ob-autocharge"
            checked={form.autoChargeConfirmed}
            onCheckedChange={(v) => patch({ autoChargeConfirmed: v === true })}
            className="mt-0.5"
          />
          <Label htmlFor="ob-autocharge" className="text-sm font-normal">
            Confirmo la carga automática de la cuota mensual bonificada en la tarjeta de crédito
            de preferencia (Itaú).
          </Label>
        </div>
      </div>
    </div>
  );
}

function StepRegistration({
  form,
  patch,
}: {
  form: FormState;
  patch: (f: Partial<FormState>) => void;
}) {
  const total = num(form.registrationFee) + num(form.patenteProportional);
  return (
    <div>
      <StepHeader
        title="Gestión de matrícula"
        description="Hay que agendar cita en la Intendencia de Montevideo para colocar las chapas."
      />
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-tasa">Tasa de empadronamiento</Label>
            <Input
              id="ob-tasa"
              inputMode="decimal"
              value={form.registrationFee}
              onChange={(e) => patch({ registrationFee: e.target.value })}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-patente">Patente proporcional 2026</Label>
            <Input
              id="ob-patente"
              inputMode="decimal"
              value={form.patenteProportional}
              onChange={(e) => patch({ patenteProportional: e.target.value })}
              className="tabular-nums"
            />
          </div>
        </div>

        <p className="text-sm">
          Total a abonar con tarjeta:{' '}
          <span className="font-medium tabular-nums">
            {formatMoney(total, form.localCurrency)}
          </span>
        </p>

        <Button variant="outline" className="w-fit" type="button" asChild>
          <a href="#" onClick={(e) => e.preventDefault()}>
            <ExternalLink className="size-4" /> Agendar cita en la IM
          </a>
        </Button>

        <div className="bg-muted/50 flex items-start gap-3 rounded-xl border p-4">
          <Checkbox
            id="ob-plate"
            checked={form.plateConfirmed}
            onCheckedChange={(v) => patch({ plateConfirmed: v === true })}
            className="mt-0.5"
          />
          <Label htmlFor="ob-plate" className="text-sm font-normal">
            Matrículas colocadas.
          </Label>
        </div>
      </div>
    </div>
  );
}

function StepSecurityPack({
  form,
  patch,
}: {
  form: FormState;
  patch: (f: Partial<FormState>) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Pack de seguridad"
        description="Opcional: láminas de seguridad y alarma oficial, el mes próximo."
      />
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-pack-amount">Monto (US$)</Label>
            <Input
              id="ob-pack-amount"
              inputMode="decimal"
              value={form.securityPackAmount}
              onChange={(e) => patch({ securityPackAmount: e.target.value })}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-pack-installments">Cuotas sin recargo</Label>
            <Input
              id="ob-pack-installments"
              inputMode="numeric"
              value={form.securityPackInstallments}
              onChange={(e) => patch({ securityPackInstallments: e.target.value })}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => patch({ wantsSecurityPack: true })}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              form.wantsSecurityPack === true
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            )}
          >
            <p className="font-medium">Agregar al flujo del mes próximo</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {form.securityPackInstallments || 6} cuotas sin recargo, desde el mes que viene.
            </p>
          </button>
          <button
            type="button"
            onClick={() => patch({ wantsSecurityPack: false })}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              form.wantsSecurityPack === false
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            )}
          >
            <p className="font-medium">Posponer por ahora</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Lo podés agregar más adelante como un gasto del auto.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

function StepConfirmation({ form }: { form: FormState }) {
  const totalPrice = num(form.downPaymentGiven) + num(form.loanAmount);
  const regTotal = num(form.registrationFee) + num(form.patenteProportional);
  return (
    <div>
      <StepHeader
        title="Resumen y activación"
        description="Así queda armado el flujo mensual de tu auto. Al finalizar se desbloquea el panel."
      />
      <div className="grid gap-3 rounded-xl border p-4">
        <SummaryRow label="Vehículo" value={`${form.name} ${form.version}`.trim()} />
        <SummaryRow
          label="Precio total"
          value={formatMoney(totalPrice, 'USD')}
        />
        <SummaryRow
          label="Préstamo"
          value={`${formatMoney(num(form.loanAmount), 'USD')} en ${form.loanMonths} cuotas`}
        />
        <SummaryRow
          label="Cuota mensual"
          value={formatMoney(num(form.monthlyPayment), form.monthlyPaymentCurrency)}
        />
        {num(form.insuranceMonthly) > 0 && (
          <SummaryRow
            label="Seguro BSE"
            value={`${formatMoney(num(form.insuranceMonthly), form.localCurrency)} / mes`}
          />
        )}
        {regTotal > 0 && (
          <SummaryRow label="Matrícula" value={formatMoney(regTotal, form.localCurrency)} />
        )}
        <SummaryRow
          label="Pack de seguridad"
          value={
            form.wantsSecurityPack
              ? `${formatMoney(num(form.securityPackAmount), 'USD')} en ${form.securityPackInstallments} cuotas`
              : 'Pospuesto'
          }
        />
        <SummaryRow
          label="Inicio de cuotas"
          value={`${MONTHS_ES[form.loanStartMonth - 1]} de ${form.loanStartYear}`}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
