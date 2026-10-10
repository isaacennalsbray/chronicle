ALTER TABLE "sessions" ALTER COLUMN "in_game_date" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_season_played_on_idx" ON "sessions" USING btree ("season_id","played_on");