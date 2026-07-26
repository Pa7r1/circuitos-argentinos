CREATE TABLE "circuit_gpx" (
	"circuit_id" uuid PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"content" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Las filas que existan apuntan a archivos del disco del servidor, que en el plan
-- gratuito se borra en cada despliegue: ya son punteros rotos. Se limpian para poder
-- exigir el contenido en las columnas nuevas.
DELETE FROM "circuit_media";--> statement-breakpoint
ALTER TABLE "circuit_media" ADD COLUMN "data" "bytea" NOT NULL;--> statement-breakpoint
ALTER TABLE "circuit_media" ADD COLUMN "content_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "circuit_gpx" ADD CONSTRAINT "circuit_gpx_circuit_id_circuits_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuits"("id") ON DELETE cascade ON UPDATE no action;