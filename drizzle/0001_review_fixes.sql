PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_questions` (
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
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "wedding_id", "type", "label", "options", "required", "scope", "event_id", "parent_question_id", "parent_option_id", "audience", "archived", "position", "created_at") SELECT "id", "wedding_id", "type", "label", "options", "required", "scope", "event_id", "parent_question_id", "parent_option_id", "audience", "archived", "position", "created_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `questions_wedding` ON `questions` (`wedding_id`);--> statement-breakpoint
ALTER TABLE `outbox` ADD `wedding_id` text REFERENCES weddings(id);--> statement-breakpoint
CREATE TABLE `__new_answers` (
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
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "answers_owner" CHECK(("__new_answers"."guest_id" IS NULL) <> ("__new_answers"."household_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_answers`("id", "wedding_id", "question_id", "guest_id", "household_id", "value", "updated_at") SELECT "id", "wedding_id", "question_id", "guest_id", "household_id", "value", "updated_at" FROM `answers`;--> statement-breakpoint
DROP TABLE `answers`;--> statement-breakpoint
ALTER TABLE `__new_answers` RENAME TO `answers`;--> statement-breakpoint
CREATE INDEX `answers_question` ON `answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `answers_wedding` ON `answers` (`wedding_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_guest` ON `answers` (`question_id`,`guest_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_household` ON `answers` (`question_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `cash_funds_wedding` ON `cash_funds` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `event_responses_wedding` ON `event_responses` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `event_responses_event` ON `event_responses` (`event_id`);--> statement-breakpoint
CREATE INDEX `events_wedding` ON `events` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `__new_fund_contributions` (
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
	FOREIGN KEY (`fund_id`) REFERENCES `cash_funds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fund_contributions_amount" CHECK("__new_fund_contributions"."amount_cents" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_fund_contributions`("id", "wedding_id", "fund_id", "giver_name", "giver_email", "amount_cents", "message", "received", "thanked_at", "created_at") SELECT "id", "wedding_id", "fund_id", "giver_name", "giver_email", "amount_cents", "message", "received", "thanked_at", "created_at" FROM `fund_contributions`;--> statement-breakpoint
DROP TABLE `fund_contributions`;--> statement-breakpoint
ALTER TABLE `__new_fund_contributions` RENAME TO `fund_contributions`;--> statement-breakpoint
CREATE INDEX `fund_contributions_wedding` ON `fund_contributions` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `fund_contributions_fund` ON `fund_contributions` (`fund_id`);--> statement-breakpoint
CREATE TABLE `__new_gift_claims` (
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
	FOREIGN KEY (`item_id`) REFERENCES `gift_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "gift_claims_quantity" CHECK("__new_gift_claims"."quantity" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_gift_claims`("id", "wedding_id", "item_id", "giver_name", "giver_email", "quantity", "message", "thanked_at", "created_at") SELECT "id", "wedding_id", "item_id", "giver_name", "giver_email", "quantity", "message", "thanked_at", "created_at" FROM `gift_claims`;--> statement-breakpoint
DROP TABLE `gift_claims`;--> statement-breakpoint
ALTER TABLE `__new_gift_claims` RENAME TO `gift_claims`;--> statement-breakpoint
CREATE INDEX `gift_claims_wedding` ON `gift_claims` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `gift_claims_item` ON `gift_claims` (`item_id`);--> statement-breakpoint
CREATE INDEX `gift_items_wedding` ON `gift_items` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `guest_tags_tag` ON `guest_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `households_wedding` ON `households` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `messages_wedding` ON `messages` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `rsvp_activity_wedding` ON `rsvp_activity` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `rsvp_activity_household` ON `rsvp_activity` (`household_id`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wedding_members_user` ON `wedding_members` (`user_id`);