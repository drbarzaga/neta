import type { Goal } from '@/db';
import { formatMoney } from '@/lib/money';

export type MotivationKind = 'celebrate' | 'almost' | 'urgent' | 'progress' | 'stalled' | 'empty';

export interface MotivationMessage {
  kind: MotivationKind;
  text: string;
  goalId?: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function progressPct(g: Goal): number {
  return g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
}

/**
 * Mensaje de ánimo para el dashboard, basado en el estado real de las metas
 * (no frases genéricas al azar): prioriza celebrar un logro reciente, avisar
 * de una meta casi lograda, avisar de una fecha objetivo cercana, o animar a
 * seguir aportando a la meta con más progreso.
 */
export function buildGoalMotivation(goals: Goal[]): MotivationMessage {
  const today = new Date();

  const recentlyCompleted = goals
    .filter((g) => g.completed && g.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
  if (recentlyCompleted) {
    const daysSince = Math.floor((today.getTime() - recentlyCompleted.completedAt!.getTime()) / DAY_MS);
    if (daysSince <= 7) {
      return {
        kind: 'celebrate',
        text: `¡Lograste tu meta "${recentlyCompleted.title}"! Gran trabajo — anímate a marcarte la próxima.`,
        goalId: recentlyCompleted.id,
      };
    }
  }

  const active = goals.filter((g) => !g.completed);
  if (active.length === 0) {
    return {
      kind: 'empty',
      text: 'Todavía no tienes metas activas. Crea una y empieza a ver tu progreso crecer.',
    };
  }

  const withDeadline = active
    .filter((g) => g.targetDate)
    .map((g) => ({
      g,
      days: Math.ceil((new Date(`${g.targetDate}T00:00:00`).getTime() - today.getTime()) / DAY_MS),
    }))
    .filter((x) => x.days >= 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days)[0];

  const byProgress = [...active].sort((a, b) => progressPct(b) - progressPct(a));
  const top = byProgress[0];
  const topPct = progressPct(top);
  const money = (g: Goal, n: number) => formatMoney(n, g.currency, 'es-UY');

  if (topPct >= 90) {
    const remaining = Math.max(0, top.targetAmount - top.savedAmount);
    return {
      kind: 'almost',
      text: `¡Estás a un paso! Solo te faltan ${money(top, remaining)} para completar "${top.title}" (${topPct.toFixed(0)}%).`,
      goalId: top.id,
    };
  }

  if (withDeadline) {
    const pct = progressPct(withDeadline.g);
    const remaining = Math.max(0, withDeadline.g.targetAmount - withDeadline.g.savedAmount);
    return {
      kind: 'urgent',
      text: `Quedan ${withDeadline.days} día${withDeadline.days === 1 ? '' : 's'} para "${withDeadline.g.title}". Llevas ${pct.toFixed(0)}%, te faltan ${money(withDeadline.g, remaining)}.`,
      goalId: withDeadline.g.id,
    };
  }

  if (topPct > 0) {
    const remaining = Math.max(0, top.targetAmount - top.savedAmount);
    return {
      kind: 'progress',
      text: `Vas bien con "${top.title}": ${topPct.toFixed(0)}% logrado, te faltan ${money(top, remaining)}. ¡Seguí así!`,
      goalId: top.id,
    };
  }

  return {
    kind: 'stalled',
    text: `Todavía no sumaste nada a "${top.title}". Cualquier aporte, por chico que sea, te acerca a la meta.`,
    goalId: top.id,
  };
}
