/**
 * Seeds the four leagues. Safe to re-run.
 *   npm run db:seed
 */
import { config } from "dotenv";

config({ path: ".env.local" });

export const LEAGUES = [
  { slug: "helios", name: "Helios", sortOrder: 1 },
  { slug: "tessellations", name: "Tessellations", sortOrder: 2 },
  { slug: "sunday-larp", name: "Sunday LARP", sortOrder: 3 },
  { slug: "adult-league", name: "Adult League", sortOrder: 4 },
];

export async function seedLeagues() {
  const { db, schema } = await import("../src/db");
  await db.insert(schema.leagues).values(LEAGUES).onConflictDoNothing({ target: schema.leagues.slug });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedLeagues().then(
    () => console.log(`Seeded ${LEAGUES.length} leagues.`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
