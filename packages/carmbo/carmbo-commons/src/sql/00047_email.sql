CREATE TABLE
    email (
        email_number SERIAL PRIMARY KEY,
        purpose TEXT NOT NULL CHECK (purpose IN ('registration-email')),
        to_email TEXT NOT NULL,
        from_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        html TEXT NOT NULL,
        text TEXT NOT NULL,
        language TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(tags) = 'object'),
        job_id INTEGER NOT NULL UNIQUE,
        resend_email_id TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        delivered_at TIMESTAMPTZ,
        success_at TIMESTAMPTZ,
        retry_timestamps JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(retry_timestamps) = 'array'),
        sending_timestamps JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(sending_timestamps) = 'array'),
        status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'retrying', 'delivered', 'success', 'failure')),
        error_text TEXT,
        last_provider_event_at TIMESTAMPTZ
    );

CREATE INDEX email_created_idx ON email (created_at DESC, email_number DESC);

ALTER TABLE community_member ADD COLUMN registration_email_number INTEGER;

CREATE INDEX community_member_registration_email_idx ON community_member (registration_email_number)
WHERE
    registration_email_number IS NOT NULL;
