CREATE TABLE "device_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expo_push_token" varchar(255) NOT NULL,
	"platform" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_push_tokens_expo_push_token_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_created', 'booking_confirmed', 'booking_declined', 'booking_cancelled', 'booking_completed', 'booking_reminder', 'offer_posted', 'offer_response_received', 'offer_accepted', 'deal_posted', 'deal_claimed', 'payment_received', 'payment_sent', 'review_received', 'message_received', 'system');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminded_at_24h" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminded_at_2h" timestamp;--> statement-breakpoint
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;