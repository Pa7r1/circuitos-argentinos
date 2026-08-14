ALTER TABLE "users" ADD COLUMN "reset_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;