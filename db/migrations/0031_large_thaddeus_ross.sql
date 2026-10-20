CREATE TABLE "ui_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"source" text DEFAULT 'datosuruguay' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ui_value_date_unique" UNIQUE("date")
);
