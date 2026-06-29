ALTER TABLE "category" ADD COLUMN "icon" text DEFAULT 'tag' NOT NULL;
--> statement-breakpoint
UPDATE "category" SET "icon" = 'credit-card' WHERE lower("name") LIKE '%tarjeta%';
--> statement-breakpoint
UPDATE "category" SET "icon" = 'piggy-bank' WHERE lower("name") LIKE '%pagarte%' OR lower("name") LIKE '%ahorro%' OR lower("name") LIKE '%fondo%';
--> statement-breakpoint
UPDATE "category" SET "icon" = 'home' WHERE lower("name") LIKE '%fijo%';
--> statement-breakpoint
UPDATE "category" SET "icon" = 'shopping-cart' WHERE lower("name") LIKE '%variable%';