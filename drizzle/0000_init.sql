CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`question_id` text NOT NULL,
	`guest_id` text,
	`household_id` text,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `answers_question` ON `answers` (`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_guest` ON `answers` (`question_id`,`guest_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_household` ON `answers` (`question_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `cash_funds` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`goal_cents` integer,
	`payment_instructions` text,
	`payment_url` text,
	`hidden` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cohost_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_responses` (
	`wedding_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`event_id` text NOT NULL,
	`attending` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`guest_id`, `event_id`),
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`starts_at` text,
	`ends_at` text,
	`venue_name` text,
	`address` text,
	`dress_code` text,
	`audience` text DEFAULT '{"mode":"all"}' NOT NULL,
	`rsvp_enabled` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fund_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`fund_id` text NOT NULL,
	`giver_name` text NOT NULL,
	`giver_email` text,
	`amount_cents` integer NOT NULL,
	`message` text,
	`received` integer DEFAULT false NOT NULL,
	`thanked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fund_id`) REFERENCES `cash_funds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gift_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`item_id` text NOT NULL,
	`giver_name` text NOT NULL,
	`giver_email` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`message` text,
	`thanked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `gift_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gift_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`store_name` text,
	`price_cents` integer,
	`quantity_wanted` integer DEFAULT 1 NOT NULL,
	`most_wanted` integer DEFAULT false NOT NULL,
	`note` text,
	`hidden` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guest_tags` (
	`guest_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`guest_id`, `tag_id`),
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`household_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`age_group` text DEFAULT 'adult' NOT NULL,
	`is_plus_one` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guests_wedding` ON `guests` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `guests_household` ON `guests` (`household_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`envelope_name` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`region` text,
	`postcode` text,
	`country` text,
	`plus_ones_allowed` integer DEFAULT 0 NOT NULL,
	`invite_token` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `households_invite_token_unique` ON `households` (`invite_token`);--> statement-breakpoint
CREATE TABLE `message_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`message_id` text NOT NULL,
	`guest_id` text,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `deliveries_message` ON `message_deliveries` (`message_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`button_target` text,
	`button_label` text,
	`recipients` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sent_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`html` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`page_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`body` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_items_page` ON `page_items` (`page_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`body` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`audience` text DEFAULT '{"mode":"all"}' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_wedding_slug` ON `pages` (`wedding_id`,`slug`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`options` text DEFAULT '[]' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`scope` text DEFAULT 'guest' NOT NULL,
	`event_id` text,
	`parent_question_id` text,
	`parent_option_id` text,
	`audience` text DEFAULT '{"mode":"all"}' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rsvp_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`household_id` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_wedding_name` ON `tags` (`wedding_id`,`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wedding_members` (
	`wedding_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`wedding_id`, `user_id`),
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weddings` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`partner_one` text NOT NULL,
	`partner_two` text NOT NULL,
	`date` text,
	`location_name` text,
	`time_zone` text DEFAULT 'Australia/Sydney' NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`site_password` text,
	`search_visible` integer DEFAULT false NOT NULL,
	`theme` text DEFAULT 'classic' NOT NULL,
	`accent_color` text DEFAULT '#7c5c3e' NOT NULL,
	`rsvp_open` integer DEFAULT true NOT NULL,
	`rsvp_deadline` text,
	`rsvp_allow_edits` integer DEFAULT true NOT NULL,
	`rsvp_closed_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weddings_slug_unique` ON `weddings` (`slug`);