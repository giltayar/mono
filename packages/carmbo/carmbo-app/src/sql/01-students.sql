DO $$ BEGIN
    CREATE TYPE OPERATION AS ENUM ('create', 'update', 'delete', 'restore');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS students (
    id SERIAL,
    timestamp TIMESTAMPTZ,
    operation OPERATION NOT NULL,
    operationReason TEXT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    birthday DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS students_history ON students (id, timestamp, operation);

CREATE TABLE IF NOT EXISTS studentsLast (
    studentId INTEGER,
    lastTimestamp TIMESTAMPTZ,
    updatedAt TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS students_last ON studentsLast (studentId);

--
-- Students Integration - Cardcom
--
CREATE TABLE IF NOT EXISTS studentsIntegrationCardcom (
    id SERIAL,
    timestamp TIMESTAMPTZ,
    operation OPERATION NOT NULL,
    operationReason TEXT,
    studentId INTEGER NOT NULL,
    cardcomCustomerId TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS studentsIntegrationCardcom_history ON studentsIntegrationCardcom (id, timestamp, operation);

CREATE TABLE IF NOT EXISTS studentsIntegrationCardcomLast (
    studentId INTEGER,
    lastTimestamp TIMESTAMPTZ,
    updatedAt TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS studentsIntegrationCardcom_last ON studentsIntegrationCardcomLast (studentId);