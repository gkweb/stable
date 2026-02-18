CREATE TABLE "journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"target_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mode" text DEFAULT 'explore' NOT NULL,
	"baseline_id" text,
	"trigger_type" text DEFAULT 'manual' NOT NULL,
	"config" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"action_type" text NOT NULL,
	"action_params" jsonb NOT NULL,
	"snapshot_before" text,
	"page_url" text NOT NULL,
	"page_title" text,
	"screenshot_path" text,
	"console_log" jsonb,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE no action ON UPDATE no action;