'use client';

import { useState, useTransition } from 'react';
import {
  CalendarClock,
  Mail,
  TriangleAlert,
  ListTodo,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { PreferenceInput } from '../schema';
import { updateEmailPreference } from '../actions';

export function PreferencesForm({ initial }: { initial: PreferenceInput }) {
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<PreferenceInput>(initial);

  function set<K extends keyof PreferenceInput>(key: K, value: PreferenceInput[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await updateEmailPreference(prefs);
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
      else toast.success('Preferencias guardadas');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones por correo</CardTitle>
        <CardDescription>
          Configura qué correos quieres recibir (vía Resend).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Toggle
          icon={CalendarClock}
          label="Recordatorios de vencimiento"
          description="Aviso cuando un gasto está por vencer."
          checked={prefs.dueRemindersEnabled}
          onCheckedChange={(v) => set('dueRemindersEnabled', v)}
        />
        {prefs.dueRemindersEnabled && (
          <div className="ml-1 grid max-w-xs gap-1.5">
            <Label htmlFor="days">Días de anticipación</Label>
            <Input
              id="days"
              type="number"
              min={0}
              max={30}
              value={prefs.dueReminderDaysBefore}
              onChange={(e) =>
                set('dueReminderDaysBefore', Number(e.target.value) || 0)
              }
            />
          </div>
        )}
        <Separator />
        <Toggle
          icon={Mail}
          label="Resumen mensual"
          description="Resumen del mes cerrado, el día 1."
          checked={prefs.monthlySummaryEnabled}
          onCheckedChange={(v) => set('monthlySummaryEnabled', v)}
        />
        <Separator />
        <Toggle
          icon={TriangleAlert}
          label="Alertas de presupuesto"
          description="Aviso cuando superas cierto porcentaje del ingreso."
          checked={prefs.budgetAlertEnabled}
          onCheckedChange={(v) => set('budgetAlertEnabled', v)}
        />
        {prefs.budgetAlertEnabled && (
          <div className="ml-1 grid max-w-xs gap-1.5">
            <Label htmlFor="threshold">Umbral de alerta (%)</Label>
            <Input
              id="threshold"
              type="number"
              min={1}
              max={200}
              value={prefs.budgetAlertThresholdPct}
              onChange={(e) =>
                set('budgetAlertThresholdPct', Number(e.target.value) || 0)
              }
            />
          </div>
        )}
        <Separator />
        <Toggle
          icon={ListTodo}
          label="Recordatorios de Todos"
          description="Aviso cuando una tarea de tu tablero está por vencer."
          checked={prefs.todoDueRemindersEnabled}
          onCheckedChange={(v) => set('todoDueRemindersEnabled', v)}
        />
        {prefs.todoDueRemindersEnabled && (
          <div className="ml-1 grid max-w-xs gap-1.5">
            <Label htmlFor="todo-days">Días de anticipación</Label>
            <Input
              id="todo-days"
              type="number"
              min={0}
              max={30}
              value={prefs.todoDueReminderDaysBefore}
              onChange={(e) =>
                set('todoDueReminderDaysBefore', Number(e.target.value) || 0)
              }
            />
          </div>
        )}
        <div>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar preferencias'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
            checked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="space-y-0.5">
          <Label>{label}</Label>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
