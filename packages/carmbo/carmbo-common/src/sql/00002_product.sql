DO $$ BEGIN
    CREATE TYPE PRODUCT_TYPE AS ENUM ('recorded', 'challenge', 'club', 'bundle');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS product (
    product_number SERIAL PRIMARY KEY,
    last_history_id UUID,
    last_data_id UUID -- denormalized for performance
);

CREATE TABLE IF NOT EXISTS product_history (
    id UUID PRIMARY KEY,
    data_id UUID NOT NULL,
    product_number SERIAL,
    timestamp TIMESTAMPTZ,
    operation HISTORY_OPERATION NOT NULL,
    operation_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS product_history_idx ON product_history (product_number, timestamp, operation);

CREATE TABLE IF NOT EXISTS product_search (
    data_id UUID NOT NULL,
    searchable_text TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_search_idx ON product_search (data_id);

CREATE TABLE IF NOT EXISTS product_data (
    data_id UUID NOT NULL,
    name TEXT NOT NULL,
    product_type PRODUCT_TYPE NOT NULL

);

CREATE UNIQUE INDEX IF NOT EXISTS product_data_idx ON product_data (data_id);

CREATE TABLE IF NOT EXISTS product_academy_course (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    workshop_id INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_academy_course_idx ON product_academy_course (data_id, item_order);

CREATE TABLE IF NOT EXISTS product_whatsapp_group (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    whatsapp_group_id TEXT NOT NULL, -- asdlfkjsldkfj@g.us
    messages_google_sheet_url TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS product_whatsapp_group_idx ON product_whatsapp_group (data_id, item_order);

CREATE TABLE IF NOT EXISTS product_facebook_group (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    facebook_group_id TEXT NOT NULL -- asdlfkjsldkfj@g.us
);

CREATE UNIQUE INDEX IF NOT EXISTS product_facebook_group_idx ON product_facebook_group (data_id, item_order);

CREATE TABLE IF NOT EXISTS product_integration_smoove (
    data_id UUID NOT NULL,
    list_id INTEGER,
    cancelling_list_id INTEGER,
    cancelled_list_id INTEGER,
    removed_list_id INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS product_integration_smoove_idx ON product_integration_smoove (data_id);

