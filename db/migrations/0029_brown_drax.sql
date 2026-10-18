CREATE TYPE "public"."salary_deposit_day_mode" AS ENUM('first_business_day', 'fixed_day');--> statement-breakpoint
CREATE TABLE "salary_deposit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"account_id" uuid,
	"amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UYU' NOT NULL,
	"day_mode" "salary_deposit_day_mode" DEFAULT 'first_business_day' NOT NULL,
	"fixed_day" integer DEFAULT 1 NOT NULL,
	"last_run_year" integer,
	"last_run_month" integer,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "salary_deposit_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "salary_deposit" ADD CONSTRAINT "salary_deposit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_deposit" ADD CONSTRAINT "salary_deposit_account_id_savings_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_account"("id") ON DELETE set null ON UPDATE no action;