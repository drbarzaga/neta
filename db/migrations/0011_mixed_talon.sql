ALTER TABLE "expense" ADD COLUMN "goal_id" uuid;--> statement-breakpoint
ALTER TABLE "goal_contribution" ADD COLUMN "expense_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;