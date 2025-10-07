DO $$ BEGIN
    CREATE TYPE HISTORY_OPERATION AS ENUM ('create', 'update', 'delete', 'restore');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS student (
    student_number SERIAL PRIMARY KEY,
    last_history_id UUID,
    last_data_id UUID -- denormalized for performance
);

CREATE TABLE IF NOT EXISTS student_history (
    id UUID PRIMARY KEY,
    data_id UUID NOT NULL,
    student_number SERIAL,
    timestamp TIMESTAMPTZ,
    operation HISTORY_OPERATION NOT NULL,
    operation_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS student_history_idx ON student_history (student_number, timestamp, operation);

CREATE TABLE IF NOT EXISTS student_search (
    data_id UUID NOT NULL,
    searchable_text TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_search_idx ON student_search (data_id);

CREATE TABLE IF NOT EXISTS student_data (
    data_id UUID NOT NULL,
    birthday DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS student_data_idx ON student_data (data_id);

CREATE TABLE IF NOT EXISTS student_email (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    email TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_email_idx ON student_email (data_id, item_order);

CREATE TABLE IF NOT EXISTS student_phone (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    phone TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_phone_idx ON student_phone (data_id, item_order);

CREATE TABLE IF NOT EXISTS student_facebook_name (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    facebook_name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_facebook_name_idx ON student_facebook_name (data_id, item_order);

CREATE TABLE IF NOT EXISTS student_name (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_name_idx ON student_name (data_id, item_order);
