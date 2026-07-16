CREATE TYPE "public"."trip_status" AS ENUM('planificando', 'en_curso', 'completado');--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"destination" text,
	"start_date" date,
	"end_date" date,
	"currency" text DEFAULT 'UYU' NOT NULL,
	"dollar_rate" numeric(14, 4) DEFAULT 0 NOT NULL,
	"budget" numeric(14, 2) DEFAULT 0 NOT NULL,
	"status" "trip_status" DEFAULT 'planificando' NOT NULL,
	"icon" text DEFAULT 'plane' NOT NULL,
	"color" text DEFAULT '#0ea5e9' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"expense_id" uuid,
	"category" text DEFAULT 'Otro' NOT NULL,
	"concept" text NOT NULL,
	"amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UYU' NOT NULL,
	"date" date,
	"paid" boolean DEFAULT false NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "trip_id" uuid;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expense" ADD CONSTRAINT "trip_expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expense" ADD CONSTRAINT "trip_expense_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expense" ADD CONSTRAINT "trip_expense_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE set null ON UPDATE no action;