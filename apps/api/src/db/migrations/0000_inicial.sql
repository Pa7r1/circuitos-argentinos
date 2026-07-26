CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TABLE "circuit_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'photo' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "circuit_media_kind_check" CHECK ("circuit_media"."kind" in ('photo','video'))
);
--> statement-breakpoint
CREATE TABLE "circuit_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens" time,
	"closes" time,
	"note" text,
	CONSTRAINT "circuit_schedules_day_of_week_check" CHECK ("circuit_schedules"."day_of_week" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "circuits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discipline_id" smallint NOT NULL,
	"province_id" smallint NOT NULL,
	"locality" text,
	"difficulty" text NOT NULL,
	"access_type" text NOT NULL,
	"access_notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"track" geography(LineString,4326) NOT NULL,
	"start_point" geography(Point,4326) NOT NULL,
	"distance_m" integer NOT NULL,
	"elevation_gain_m" integer,
	"gpx_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circuits_slug_unique" UNIQUE("slug"),
	CONSTRAINT "circuits_difficulty_check" CHECK ("circuits"."difficulty" in ('facil','intermedio','dificil','extremo')),
	CONSTRAINT "circuits_access_type_check" CHECK ("circuits"."access_type" in ('libre','con_permiso','pago')),
	CONSTRAINT "circuits_status_check" CHECK ("circuits"."status" in ('draft','published','archived'))
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"id" smallserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "disciplines_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" smallserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "provinces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "circuit_media" ADD CONSTRAINT "circuit_media_circuit_id_circuits_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_schedules" ADD CONSTRAINT "circuit_schedules_circuit_id_circuits_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circuits_status_discipline_province_idx" ON "circuits" USING btree ("status","discipline_id","province_id");--> statement-breakpoint
CREATE INDEX "circuits_start_point_gist_idx" ON "circuits" USING gist ("start_point");--> statement-breakpoint
CREATE INDEX "circuits_track_gist_idx" ON "circuits" USING gist ("track");--> statement-breakpoint
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER circuits_set_updated_at
BEFORE UPDATE ON circuits
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
