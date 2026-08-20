ALTER TABLE "circuits" DROP CONSTRAINT "circuits_status_check";--> statement-breakpoint
ALTER TABLE "circuits" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "circuits" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_status_check" CHECK ("circuits"."status" in ('draft','published','archived','propuesto','rechazado'));