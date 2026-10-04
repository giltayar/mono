CREATE TABLE
  jobs (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    number_of_retries INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0
  );

CREATE INDEX jobs_status_idx ON jobs (scheduled_at);