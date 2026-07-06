CREATE TABLE "savings_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'piggy-bank' NOT NULL,
	"color" text DEFAULT '#10b981' NOT NULL,
	"currency" text DEFAULT 'UYU' NOT NULL,
	"balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "savings_account" ADD CONSTRAINT "savings_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_movement" ADD CONSTRAINT "savings_movement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_movement" ADD CONSTRAINT "savings_movement_account_id_savings_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_account"("id") ON DELETE cascade ON UPDATE no action;