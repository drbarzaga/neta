CREATE TYPE "public"."vehicle_status" AS ENUM('ahorrando', 'financiando', 'pagado');--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"year" integer,
	"total_price" numeric(14, 2) DEFAULT 0 NOT NULL,
	"down_payment_target" numeric(14, 2) DEFAULT 0 NOT NULL,
	"down_payment_saved" numeric(14, 2) DEFAULT 0 NOT NULL,
	"loan_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"loan_months" integer DEFAULT 0 NOT NULL,
	"loan_start_month" integer DEFAULT 1 NOT NULL,
	"loan_start_year" integer DEFAULT 2026 NOT NULL,
	"monthly_payment" numeric(14, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"dollar_rate" numeric(14, 4) DEFAULT 0 NOT NULL,
	"status" "vehicle_status" DEFAULT 'financiando' NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"category" text DEFAULT 'Otro' NOT NULL,
	"concept" text NOT NULL,
	"amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_expense" ADD CONSTRAINT "vehicle_expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_expense" ADD CONSTRAINT "vehicle_expense_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;