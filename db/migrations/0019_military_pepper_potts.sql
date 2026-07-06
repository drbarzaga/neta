ALTER TABLE "expense" ADD COLUMN "savings_account_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_movement" ADD COLUMN "expense_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_savings_account_id_savings_account_id_fk" FOREIGN KEY ("savings_account_id") REFERENCES "public"."savings_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_movement" ADD CONSTRAINT "savings_movement_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;