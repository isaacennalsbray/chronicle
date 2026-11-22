CREATE TABLE "downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"chronicle_id" integer,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_chronicle_id_chronicles_id_fk" FOREIGN KEY ("chronicle_id") REFERENCES "public"."chronicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "downloads_created_idx" ON "downloads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "downloads_user_idx" ON "downloads" USING btree ("user_id","created_at");