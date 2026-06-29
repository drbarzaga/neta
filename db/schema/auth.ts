import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

// Tablas requeridas por Better Auth. La config usa casing snake_case,
// por lo que las claves camelCase se mapean a columnas snake_case en la BD.
export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  password: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

// Tabla del plugin de passkeys (WebAuthn). Los nombres de propiedad en
// camelCase los espera Better Auth; el casing snake_case los mapea a columnas.
export const passkey = pgTable('passkey', {
  id: text().primaryKey(),
  name: text(),
  publicKey: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text().notNull(),
  counter: integer().notNull(),
  deviceType: text().notNull(),
  backedUp: boolean().notNull(),
  transports: text(),
  aaguid: text(),
  createdAt: timestamp().defaultNow(),
});
