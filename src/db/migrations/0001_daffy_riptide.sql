ALTER TABLE "bookings" ALTER COLUMN "payment_provider" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_provider";--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('paystack');--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "payment_provider" SET DATA TYPE "public"."payment_provider" USING "payment_provider"::"public"."payment_provider";