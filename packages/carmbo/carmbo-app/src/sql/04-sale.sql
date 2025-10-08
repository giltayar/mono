DO $$ BEGIN
    CREATE TYPE SALE_OPERATION AS ENUM ('create');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS sale (
  sale_number SERIAL PRIMARY KEY,
  last_history_id UUID,
  last_data_id UUID -- denormalized for performance
);

CREATE TABLE IF NOT EXISTS sale_history (
  id UUID PRIMARY KEY,
  data_id UUID NOT NULL,
  sale_number SERIAL,
  timestamp TIMESTAMPTZ,
  operation HISTORY_OPERATION NOT NULL,
  operation_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_history_idx ON sale_history (sale_number, timestamp, operation);

CREATE TABLE IF NOT EXISTS sale_info_search (
  sale_number INTEGER NOT NULL,
  searchable_text TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_info_search_idx ON sale_info_search (sale_number);

CREATE TABLE IF NOT EXISTS sale_info (
  sale_number INTEGER NOT NULL,
  sale_event_number INTEGER NOT NULL,
  student_number INTEGER NOT NULL,
  final_sale_revenue NUMERIC(10, 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_info_idx ON sale_info (sale_number);

CREATE TABLE IF NOT EXISTS sale_info_product (
  sale_number INTEGER NOT NULL,
  item_order INTEGER NOT NULL,
  product_number INTEGER NOT NULL,
  quantity INTEGER NOT NULL, -- 0 means it was not bought
  unit_price NUMERIC(10, 2) -- not necessarily what it was bought for. Just what was the price asked for
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_info_product_idx ON sale_info_product (sale_number, item_order);

CREATE TABLE IF NOT EXISTS sale_info_cardcom (
  sale_number INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  invoice_number TEXT NOT NULL,
  terminal_number TEXT NOT NULL,
  approval_number TEXT NOT NULL,
  sale_timestamp TIMESTAMPTZ NOT NULL,
  user_email TEXT,
  coupon TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_info_cardcom_idx ON sale_info_cardcom (sale_number);
