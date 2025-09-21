DO $$ BEGIN
    CREATE TYPE OPERATION AS ENUM ('create', 'update', 'delete', 'restore');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS student (
    student_number SERIAL PRIMARY KEY,
    last_operation_id UUID
);

CREATE TABLE IF NOT EXISTS student_operation (
    id UUID PRIMARY KEY,
    student_number SERIAL,
    timestamp TIMESTAMPTZ,
    operation OPERATION NOT NULL,
    operation_reason TEXT,

    birthday DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS student_operation_idx ON student_operation (student_number, timestamp, operation);

CREATE TABLE IF NOT EXISTS student_email (
    operation_id UUID,
    item_order INTEGER NOT NULL,
    email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_phone (
    operation_id UUID,
    item_order INTEGER NOT NULL,
    phone TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_email_idx ON student_email (operation_id, item_order);

CREATE TABLE IF NOT EXISTS student_facebook_name (
    operation_id UUID,
    item_order INTEGER NOT NULL,
    facebook_name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_facebook_name_idx ON student_facebook_name (operation_id, item_order);

CREATE TABLE IF NOT EXISTS student_name (
    operation_id UUID,
    item_order INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_name_idx ON student_name (operation_id, item_order);

CREATE TABLE IF NOT EXISTS student_integration_cardcom (
    operation_id UUID,
    customer_id TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_integration_cardcom_idx ON student_integration_cardcom (operation_id);
