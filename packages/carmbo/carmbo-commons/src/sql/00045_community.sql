CREATE TABLE IF NOT EXISTS community (
    community_number SERIAL PRIMARY KEY,
    last_history_id UUID,
    last_data_id UUID -- denormalized for performance
);

CREATE TABLE IF NOT EXISTS community_history (
    id UUID PRIMARY KEY,
    data_id UUID NOT NULL,
    community_number SERIAL,
    timestamp TIMESTAMPTZ,
    operation HISTORY_OPERATION NOT NULL,
    operation_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS community_history_idx ON community_history (community_number, timestamp, operation);

CREATE TABLE IF NOT EXISTS community_search (
    data_id UUID NOT NULL,
    searchable_text TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS community_search_idx ON community_search (data_id);

CREATE TABLE IF NOT EXISTS community_data (
    data_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS community_data_idx ON community_data (data_id);
