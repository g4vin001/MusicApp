CREATE TABLE `license_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`song` text NOT NULL,
	`platform` text NOT NULL,
	`notes` text NOT NULL,
	`url` text NOT NULL,
	`attribution` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_license_notes_owner_updated` ON `license_notes` (`owner`,`updated`);--> statement-breakpoint
CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`job_id` text DEFAULT '' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_product_events_created_kind` ON `product_events` (`created`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_product_events_owner_created` ON `product_events` (`owner`,`created`);--> statement-breakpoint
ALTER TABLE `scan_jobs` ADD `review` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `scan_jobs` ADD `review_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER count_creator_ai_reservation AFTER INSERT ON operations
WHEN NEW.kind='creator_ai'
BEGIN
  INSERT INTO recognition_meter(id,used) VALUES('creator_ai',1)
  ON CONFLICT(id) DO UPDATE SET used=recognition_meter.used+1;
END;
