CREATE TYPE "public"."chronicle_status" AS ENUM('pending', 'approved');--> statement-breakpoint
CREATE TABLE "chronicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"character_name" text NOT NULL,
	"player_name" text NOT NULL,
	"body_text" text,
	"author_user_id" integer,
	"status" "chronicle_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"legacy_file_url" text,
	"legacy_file_content_type" text,
	"legacy_source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "leagues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"request_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"league_id" integer NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"codename" text,
	"legacy_source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"in_game_date" text NOT NULL,
	"played_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"player_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chronicles_session_idx" ON "chronicles" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chronicles_status_idx" ON "chronicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chronicles_author_idx" ON "chronicles" USING btree ("author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chronicles_legacy_source_idx" ON "chronicles" USING btree ("legacy_source_url");--> statement-breakpoint
CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_codes_ip_idx" ON "login_codes" USING btree ("request_ip","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_league_slug_idx" ON "seasons" USING btree ("league_id","slug");--> statement-breakpoint
CREATE INDEX "sessions_season_idx" ON "sessions" USING btree ("season_id");