CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`kind` text NOT NULL,
	`page_item_id` text,
	`page_id` text,
	`url` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`alt` text,
	`caption` text,
	`focus` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_item_id`) REFERENCES `page_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photos_owner" CHECK(("photos"."kind" = 'cover' AND "photos"."page_item_id" IS NULL AND "photos"."page_id" IS NULL) OR ("photos"."kind" = 'item' AND "photos"."page_item_id" IS NOT NULL AND "photos"."page_id" IS NULL) OR ("photos"."kind" = 'gallery' AND "photos"."page_id" IS NOT NULL AND "photos"."page_item_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_one_cover` ON `photos` (`wedding_id`) WHERE "photos"."kind" = 'cover';--> statement-breakpoint
CREATE UNIQUE INDEX `photos_one_per_item` ON `photos` (`page_item_id`);--> statement-breakpoint
CREATE INDEX `photos_page` ON `photos` (`page_id`,`position`);