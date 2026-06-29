CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"country" text DEFAULT 'UY' NOT NULL,
	"ar_casa" text DEFAULT 'blue' NOT NULL,
	"display_currency" text DEFAULT 'local' NOT NULL,
	CONSTRAINT "user_settings_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "exchange_rate" DROP CONSTRAINT "exchange_rate_date_unique";--> statement-breakpoint
ALTER TABLE "period" ALTER COLUMN "dollar_rate" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "currency" SET DATA TYPE text USING "currency"::text;--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "currency" SET DEFAULT 'UYU';--> statement-breakpoint
ALTER TABLE "expense_template" ALTER COLUMN "currency" SET DATA TYPE text USING "currency"::text;--> statement-breakpoint
ALTER TABLE "expense_template" ALTER COLUMN "currency" SET DEFAULT 'UYU';--> statement-breakpoint
ALTER TABLE "exchange_rate" ALTER COLUMN "usd_to_uyu" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "period" ADD COLUMN "local_currency" text DEFAULT 'UYU' NOT NULL;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD COLUMN "country" text DEFAULT 'UY' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_date_country_unique" UNIQUE("date","country");--> statement-breakpoint
DROP TYPE "public"."currency";