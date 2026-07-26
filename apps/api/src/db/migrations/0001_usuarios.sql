CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"discipline_id" smallint,
	"role" text DEFAULT 'user' NOT NULL,
	"oauth_provider" text,
	"oauth_subject" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_oauth_unique" UNIQUE("oauth_provider","oauth_subject"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user','admin')),
	CONSTRAINT "users_credencial_check" CHECK ("users"."password_hash" is not null or ("users"."oauth_provider" is not null and "users"."oauth_subject" is not null))
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
