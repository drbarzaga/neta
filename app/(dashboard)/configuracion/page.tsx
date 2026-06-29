import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getOrCreateEmailPreference, getOrCreateUserSettings } from './queries';
import { PreferencesForm } from './_components/preferences-form';
import { RegionForm } from './_components/region-form';
import { AppearanceForm } from './_components/appearance-form';
import { PasskeysForm } from './_components/passkeys-form';

export const metadata: Metadata = { title: 'Configuración — Neta' };

export default async function ConfiguracionPage() {
  const { userId, user } = await requireSession();
  const pref = await getOrCreateEmailPreference(userId);
  const settings = await getOrCreateUserSettings(userId);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Tu perfil y preferencias de notificación.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Datos de tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={user.name} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>
        </CardContent>
      </Card>

      <RegionForm
        initial={{
          country: settings.country,
          arCasa: settings.arCasa,
          displayCurrency: settings.displayCurrency === 'usd' ? 'usd' : 'local',
        }}
      />

      <PasskeysForm />

      <AppearanceForm initialEnabled={settings.animationsEnabled} />

      <PreferencesForm
        initial={{
          dueRemindersEnabled: pref.dueRemindersEnabled,
          dueReminderDaysBefore: pref.dueReminderDaysBefore,
          monthlySummaryEnabled: pref.monthlySummaryEnabled,
          budgetAlertEnabled: pref.budgetAlertEnabled,
          budgetAlertThresholdPct: pref.budgetAlertThresholdPct,
        }}
      />
    </div>
  );
}
