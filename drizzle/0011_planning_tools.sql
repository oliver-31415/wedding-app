CREATE TABLE `budget_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`estimate_cents` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `budget_categories_wedding` ON `budget_categories` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `run_sheet_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`time` text,
	`title` text NOT NULL,
	`location` text,
	`who` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_sheet_items_wedding` ON `run_sheet_items` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `seat_assignments` (
	`guest_id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`table_id` text NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `seating_tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seat_assignments_wedding` ON `seat_assignments` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `seat_assignments_table` ON `seat_assignments` (`table_id`);--> statement-breakpoint
CREATE TABLE `seating_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 10 NOT NULL,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seating_tables_wedding` ON `seating_tables` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`moment` text,
	`title` text NOT NULL,
	`artist` text,
	`do_not_play` integer DEFAULT false NOT NULL,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `songs_wedding` ON `songs` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`due_date` text,
	`assignee_id` text,
	`done_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_wedding` ON `tasks` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `vendor_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`label` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text,
	`paid_on` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vendor_payments_wedding` ON `vendor_payments` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `vendor_payments_vendor` ON `vendor_payments` (`vendor_id`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`status` text DEFAULT 'considering' NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`website` text,
	`quote_cents` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `budget_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vendors_wedding` ON `vendors` (`wedding_id`);--> statement-breakpoint
ALTER TABLE `weddings` ADD `budget_cents` integer;