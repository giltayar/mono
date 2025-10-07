CREATE TABLE
    IF NOT EXISTS student_integration_smoove (
        data_id UUID NOT NULL,
        smoove_contact_id INTEGER NOT NULL
    );

CREATE UNIQUE INDEX IF NOT EXISTS student_integration_smoove_idx ON student_integration_smoove (data_id);