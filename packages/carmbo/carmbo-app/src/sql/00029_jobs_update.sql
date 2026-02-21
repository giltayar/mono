ALTER TABLE jobs ADD COLUMN "parent_job_id" INTEGER;

ALTER TABLE jobs ADD COLUMN "finished_at" TIMESTAMPTZ;

ALTER TABLE jobs ADD COLUMN "error_message" TEXT;

ALTER TABLE jobs ADD COLUMN "error" TEXT;

ALTER TABLE jobs ADD COLUMN "description" TEXT;
