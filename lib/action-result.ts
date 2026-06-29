export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: T;
}

export const UNAUTHORIZED = { ok: false, error: 'No autorizado.' } as const;

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
