CREATE TABLE "loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"principal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"annual_rate" numeric(7, 3) DEFAULT 0 NOT NULL,
	"term_months" integer DEFAULT 1 NOT NULL,
	"start_date" date,
	"currency" text DEFAULT 'UYU' NOT NULL,
	"paid_installments" integer DEFAULT 0 NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;