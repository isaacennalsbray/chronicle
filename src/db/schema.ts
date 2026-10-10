import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  // Remembered from the last submission to prefill the form.
  playerName: text("player_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginCodes = pgTable(
  "login_codes",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    requestIp: text("request_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("login_codes_email_idx").on(t.email, t.createdAt),
    index("login_codes_ip_idx").on(t.requestIp, t.createdAt),
  ],
);

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// One season of one league, e.g. Helios S14 ("Eldar Chronicles"). The codename
// changes season to season, so it lives here rather than on the league.
export const seasons = pgTable(
  "seasons",
  {
    id: serial("id").primaryKey(),
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id),
    slug: text("slug").notNull(), // e.g. "s14"
    label: text("label").notNull(), // e.g. "S14"
    codename: text("codename"), // e.g. "Eldar"
    legacySourceUrl: text("legacy_source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seasons_league_slug_idx").on(t.leagueId, t.slug)],
);

// One game day within a season. Sessions created from a player's submission start
// with only the real-world date; an admin fills in the in-game date later.
export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    inGameDate: text("in_game_date"), // e.g. "4th of Ninthmoon, 287.3.3"
    playedOn: date("played_on"), // real-world date, if known
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_season_idx").on(t.seasonId),
    uniqueIndex("sessions_season_played_on_idx").on(t.seasonId, t.playedOn),
  ],
);

export const chronicleStatus = pgEnum("chronicle_status", ["pending", "approved"]);

export const chronicles = pgTable(
  "chronicles",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    characterName: text("character_name").notNull(),
    playerName: text("player_name").notNull(),
    // Null for legacy imports, whose content lives only in the original file.
    bodyText: text("body_text"),
    // Real date of the event, worked out from the session's in-game date and the year
    // the player gave. Used for the PDF file name.
    eventDate: date("event_date"),
    // Null for legacy imports with no site account.
    authorUserId: integer("author_user_id").references(() => users.id),
    status: chronicleStatus("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    // Original PDF or image from the old site, stored in Vercel Blob.
    legacyFileUrl: text("legacy_file_url"),
    legacyFileContentType: text("legacy_file_content_type"),
    // Original falnoriangames.com page/file, for future redirect mapping.
    legacySourceUrl: text("legacy_source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("chronicles_session_idx").on(t.sessionId),
    index("chronicles_status_idx").on(t.status),
    index("chronicles_author_idx").on(t.authorUserId),
    uniqueIndex("chronicles_legacy_source_idx").on(t.legacySourceUrl),
  ],
);

export type Chronicle = typeof chronicles.$inferSelect;
