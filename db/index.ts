import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está configurada.');
  }
  return drizzle({ client: neon(url), schema, casing: 'snake_case' });
}

// Inicialización perezosa: el cliente neon se crea en el primer uso (runtime),
// no al importar el módulo, para que `next build` funcione sin DATABASE_URL.
let _db: ReturnType<typeof createDb> | undefined;
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    _db ??= createDb();
    return Reflect.get(_db, prop, receiver);
  },
});

export * from './schema';
export {
  eq,
  and,
  or,
  ne,
  gt,
  gte,
  lt,
  lte,
  inArray,
  isNull,
  isNotNull,
  desc,
  asc,
  count,
  sum,
  sql,
} from 'drizzle-orm';
