CREATE TABLE
    email_template (
        email_template_number SERIAL PRIMARY KEY,
        last_history_id UUID NOT NULL,
        last_data_id UUID NOT NULL
    );

CREATE TABLE
    email_template_data (
        data_id UUID PRIMARY KEY,
        email_template_number INTEGER NOT NULL,
        name TEXT NOT NULL CHECK (length (btrim (name)) > 0),
        description TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL CHECK (length (btrim (subject)) > 0),
        text TEXT NOT NULL,
        html TEXT NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('he', 'en')),
        editor_document JSONB NOT NULL CHECK (jsonb_typeof(editor_document) = 'object'),
        editor_document_version INTEGER NOT NULL DEFAULT 1 CHECK (editor_document_version > 0),
        preview_values JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(preview_values) = 'object')
    );

CREATE TABLE
    email_template_history (
        id UUID PRIMARY KEY,
        email_template_number INTEGER NOT NULL,
        data_id UUID NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        operation HISTORY_OPERATION NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'restore')),
        operation_reason TEXT
    );

CREATE INDEX email_template_history_template_idx ON email_template_history (
    email_template_number,
    timestamp DESC,
    id
);

CREATE TABLE
    email_template_search (
        data_id UUID PRIMARY KEY,
        searchable_text TEXT NOT NULL
    );
