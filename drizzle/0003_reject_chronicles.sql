ALTER TYPE "public"."chronicle_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "rejected_at" timestamp with time zone;