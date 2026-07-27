ALTER TABLE "circuits" ALTER COLUMN "track" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "circuits" ADD COLUMN "external_map_url" text;--> statement-breakpoint
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_track_o_enlace_check" CHECK ("circuits"."track" is not null or "circuits"."external_map_url" is not null);