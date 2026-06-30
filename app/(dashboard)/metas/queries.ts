import 'server-only';
import {
  db,
  eq,
  and,
  asc,
  desc,
  goal,
  goalContribution,
  type Goal,
  type GoalContribution,
} from '@/db';

/** Metas del usuario: activas primero, luego por orden y fecha de creación. */
export async function getGoals(userId: string): Promise<Goal[]> {
  return db
    .select()
    .from(goal)
    .where(eq(goal.userId, userId))
    .orderBy(asc(goal.completed), asc(goal.sortOrder), asc(goal.createdAt));
}

/** Una meta del usuario, o null si no existe / no le pertenece. */
export async function getGoal(
  userId: string,
  id: string
): Promise<Goal | null> {
  const [row] = await db
    .select()
    .from(goal)
    .where(and(eq(goal.id, id), eq(goal.userId, userId)));
  return row ?? null;
}

/** Historial de abonos de una meta (más recientes primero). */
export async function getGoalContributions(
  userId: string,
  goalId: string
): Promise<GoalContribution[]> {
  return db
    .select()
    .from(goalContribution)
    .where(
      and(
        eq(goalContribution.userId, userId),
        eq(goalContribution.goalId, goalId)
      )
    )
    .orderBy(desc(goalContribution.createdAt));
}
