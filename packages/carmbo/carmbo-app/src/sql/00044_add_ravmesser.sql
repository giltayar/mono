DO $$ BEGIN
    CREATE TYPE MAILING_LIST_PROVIDER AS ENUM ('smoove', 'ravmesser');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- The DEFAULT backfills every existing (immutable) product version to smoove
ALTER TABLE product_data ADD COLUMN IF NOT EXISTS mailing_list_provider MAILING_LIST_PROVIDER NOT NULL DEFAULT 'smoove';

CREATE TABLE IF NOT EXISTS product_integration_ravmesser (
    data_id UUID NOT NULL,
    list_id INTEGER,
    cancelled_list_id INTEGER,
    removed_list_id INTEGER,
    removed_date_custom_field INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS product_integration_ravmesser_idx ON product_integration_ravmesser (data_id);

CREATE TABLE IF NOT EXISTS student_integration_ravmesser (
    data_id UUID NOT NULL,
    ravmesser_contact_id INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS student_integration_ravmesser_idx ON student_integration_ravmesser (data_id);
