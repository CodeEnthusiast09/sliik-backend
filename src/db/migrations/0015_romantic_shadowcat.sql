CREATE TYPE "public"."category" AS ENUM('hair', 'braids', 'wig_install', 'makeup', 'lashes', 'nails', 'barbering', 'mens_grooming');--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "category" "category";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "add_ons" text[];--> statement-breakpoint
ALTER TABLE "portfolio" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "portfolio" ADD COLUMN "category" "category";--> statement-breakpoint
ALTER TABLE "portfolio" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_payout_accounts" ADD COLUMN "bank_name" varchar(255);--> statement-breakpoint
-- Backfill sort_order for existing portfolio rows (all default to 0 above) so
-- they keep their current creation-order display until a provider explicitly
-- reorders them via PATCH /portfolio/reorder.
UPDATE "portfolio" AS p
SET "sort_order" = ranked.rank
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "provider_id" ORDER BY "created_at") - 1 AS rank
  FROM "portfolio"
) AS ranked
WHERE p."id" = ranked."id";