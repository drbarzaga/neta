import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getOrCreateEmailPreference, getOrCreateUserSettings, getOrCreateSalaryDeposit } from './queries';
import { getSavingsAccounts } from '../ahorros/queries';
import { ProfileForm } from './_components/profile-form';
import { PreferencesForm } from './_components/preferences-form';
import { RegionForm } from './_components/region-form';
import { AppearanceForm } from './_components/appearance-form';
import { PasskeysForm } from './_components/passkeys-form';
import { ApiKeyForm } from './_components/api-key-form';
import { SalaryDepositForm } from './_components/salary-deposit-form';

export const metadata: Metadata = { title: 'Configuración — Neta' };

export default async function ConfiguracionPage() {
  const { userId, user } = await requireSession();
  const pref = await getOrCreateEmailPreference(userId);
  const settings = await getOrCreateUserSettings(userId);
  const salary = await getOrCreateSalaryDeposit(userId);
  const accounts = await getSavingsAccounts(userId);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Tu perfil y preferencias de notificación.
        </p>
      </div>

      <ProfileForm initialName={user.name} initialEmail={user.email} />

      <RegionForm
        initial={{
          country: settings.country,
          arCasa: settings.arCasa,
          displayCurrency: settings.displayCurrency === 'usd' ? 'usd' : 'local',
        }}
      />

      <PasskeysForm />

      <ApiKeyForm configured={Boolean(settings.anthropicApiKey)} />

      <AppearanceForm initialEnabled={settings.animationsEnabled} />

      <SalaryDepositForm
        initial={{
          enabled: salary.enabled,
          accountId: salary.accountId,
          amount: salary.amount,
          currency: salary.currency,
          dayMode: salary.dayMode,
          fixedDay: salary.fixedDay,
        }}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
      />

      <PreferencesForm
        initial={{
          dueRemindersEnabled: pref.dueRemindersEnabled,
          dueReminderDaysBefore: pref.dueReminderDaysBefore,
          monthlySummaryEnabled: pref.monthlySummaryEnabled,
          budgetAlertEnabled: pref.budgetAlertEnabled,
          budgetAlertThresholdPct: pref.budgetAlertThresholdPct,
          todoDueRemindersEnabled: pref.todoDueRemindersEnabled,
          todoDueReminderDaysBefore: pref.todoDueReminderDaysBefore,
        }}
      />
    </div>
  );
}
