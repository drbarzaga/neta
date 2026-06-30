import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../../configuracion/queries';
import { getGoal, getGoalContributions } from '../queries';
import { GoalDetail } from './_components/goal-detail';

export const metadata: Metadata = { title: 'Meta — Neta' };

export default async function MetaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireSession();

  const goal = await getGoal(userId, id);
  if (!goal) notFound();

  const [contributions, settings] = await Promise.all([
    getGoalContributions(userId, id),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);

  return (
    <GoalDetail
      goal={goal}
      contributions={contributions}
      locale={country.locale}
      localCurrency={country.currency}
    />
  );
}
