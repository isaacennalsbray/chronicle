# chronicle
LARP Chronicles

Players submit chronicles (session write-ups) for Falnorian Games leagues; an admin approves them before they go public.

Next.js (App Router) · Neon Postgres via Drizzle · Vercel Blob · Resend · pdf-lib.

## Structure

- **League** (Helios, Tessellations, Sunday LARP, Adult League) → **Season** (e.g. S14, codename "Eldar") → **Session** (one game day, labelled by its in-game date) → **Chronicles** (one per character/player).
- Admins create seasons and sessions at `/admin`; players pick a session when submitting.
- New chronicles are plain text and their PDFs are generated on download. Imported legacy chronicles keep their original PDF/JPG in Vercel Blob.

## Setup

1. Link the Vercel project and connect a **Neon** database and a **Blob** store from the Vercel dashboard (Storage tab).
2. `vercel env pull .env.local`, then add `SESSION_SECRET`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL` (see `.env.example`).
3. Create the tables and import the legacy chronicles:

   ```bash
   npm run db:migrate
   npm run import:legacy      # also seeds the leagues; add -- --dry-run to preview
   ```

4. `npm run dev`. Without `RESEND_API_KEY`, emails (including login codes) are printed to the dev server console.

After changing `src/db/schema.ts`, run `npm run db:generate` to create a migration.
