CREATE TABLE "trip_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_day_tripId_date_unique" UNIQUE("trip_id","date")
);
--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "travelers" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_expense" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "trip_day" ADD CONSTRAINT "trip_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_day" ADD CONSTRAINT "trip_day_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;