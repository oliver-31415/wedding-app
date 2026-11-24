CREATE TABLE `contact_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`people` text NOT NULL,
	`address` text NOT NULL,
	`note` text,
	`household_id` text,
	`via` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contact_submissions_wedding` ON `contact_submissions` (`wedding_id`,`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`message_id` text NOT NULL,
	`guest_id` text,
	`email` text,
	`method` text DEFAULT 'email' NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "deliveries_email_or_other" CHECK(("__new_message_deliveries"."method" = 'email') = ("__new_message_deliveries"."email" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_message_deliveries`("id", "wedding_id", "message_id", "guest_id", "email", "method", "status", "error", "created_at") SELECT "id", "wedding_id", "message_id", "guest_id", "email", 'email', "status", "error", "created_at" FROM `message_deliveries`;--> statement-breakpoint
DROP TABLE `message_deliveries`;--> statement-breakpoint
ALTER TABLE `__new_message_deliveries` RENAME TO `message_deliveries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `deliveries_message` ON `message_deliveries` (`message_id`);--> statement-breakpoint
ALTER TABLE `weddings` ADD `contact_collector_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `weddings_contact_collector_token_unique` ON `weddings` (`contact_collector_token`);