CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"concept" text NOT NULL,
	"currency" text DEFAULT 'UYU' NOT NULL,
	"installment_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"installments_count" integer DEFAULT 1 NOT NULL,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "installment_number" integer;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "installments_count" integer;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE cascade ON UPDATE no action;