CREATE TABLE "provider_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"paystack_subaccount_code" varchar(100) NOT NULL,
	"bank_code" varchar(20) NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_payout_accounts_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
ALTER TABLE "provider_payout_accounts" ADD CONSTRAINT "provider_payout_accounts_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;