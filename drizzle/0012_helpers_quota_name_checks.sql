CREATE TABLE `email_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `email_sends_created` ON `email_sends` (`created_at`);--> statement-breakpoint
CREATE TABLE `helpers` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`email` text,
	`phone` text,
	`token` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `helpers_token_unique` ON `helpers` (`token`);--> statement-breakpoint
CREATE INDEX `helpers_wedding` ON `helpers` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `job_helpers` (
	`job_id` text NOT NULL,
	`helper_id` text NOT NULL,
	PRIMARY KEY(`job_id`, `helper_id`),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`helper_id`) REFERENCES `helpers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_helpers_helper` ON `job_helpers` (`helper_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`run_sheet_item_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`start_time` text,
	`end_time` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_sheet_item_id`) REFERENCES `run_sheet_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_wedding` ON `jobs` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `jobs_item` ON `jobs` (`run_sheet_item_id`);--> statement-breakpoint
CREATE TABLE `name_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`guest_id` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `name_requests_wedding` ON `name_requests` (`wedding_id`,`status`);