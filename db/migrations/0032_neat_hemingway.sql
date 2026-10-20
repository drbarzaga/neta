ALTER TABLE "vehicle" ADD COLUMN "loan_unit" text DEFAULT 'currency' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "monthly_payment_ui" numeric(14, 4) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "ui_rate_at_origination" numeric(10, 4) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_expense" ADD COLUMN "amount_ui" numeric(14, 4);