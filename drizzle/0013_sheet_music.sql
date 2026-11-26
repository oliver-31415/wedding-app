CREATE TABLE `song_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`song_id` text NOT NULL,
	`instrument` text NOT NULL,
	`sheet_url` text,
	`sheet_name` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `song_parts_wedding` ON `song_parts` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `song_parts_song` ON `song_parts` (`song_id`);