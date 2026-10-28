CREATE SEQUENCE community_member_entry_order_seq;

CREATE TABLE
    community_member (
        community_member_number SERIAL PRIMARY KEY,
        community_number INTEGER NOT NULL,
        student_number INTEGER NOT NULL,
        last_history_id UUID NOT NULL,
        UNIQUE (community_number, student_number)
    );

CREATE TABLE
    community_member_data (
        data_id UUID PRIMARY KEY,
        community_member_number INTEGER NOT NULL,
        entered_at TIMESTAMPTZ NOT NULL,
        entry_order BIGINT NOT NULL DEFAULT nextval ('community_member_entry_order_seq'),
        poster BOOLEAN NOT NULL DEFAULT FALSE,
        live_streamer BOOLEAN NOT NULL DEFAULT FALSE,
        moderator BOOLEAN NOT NULL DEFAULT FALSE,
        user_blocker BOOLEAN NOT NULL DEFAULT FALSE,
        user_approver BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL,
        reason_code TEXT,
        reason_text TEXT,
        registration_email_sent_at TIMESTAMPTZ
    );

CREATE INDEX community_member_data_entry_idx ON community_member_data (entered_at DESC, entry_order DESC);

CREATE TABLE
    community_member_history (
        id UUID PRIMARY KEY,
        community_member_number INTEGER NOT NULL,
        data_id UUID NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        operation TEXT NOT NULL,
        operation_reason TEXT,
        UNIQUE (community_member_number, id, data_id)
    );

CREATE INDEX community_member_history_member_idx ON community_member_history (
    community_member_number,
    timestamp DESC
);