DROP TABLE sale CASCADE;

DROP TABLE sale_info_search CASCADE;

DROP TABLE sale_history CASCADE;

DROP TABLE sale_info CASCADE;

DROP TABLE sale_info_product CASCADE;

DROP TABLE sale_info_cardcom CASCADE;

DROP TABLE sale_info_manual CASCADE;

CREATE TABLE
  IF NOT EXISTS sale (
    sale_number SERIAL PRIMARY KEY,
    last_history_id UUID,
    last_data_id UUID,
    last_data_product_id UUID,
    data_cardcom_id UUID
  );

CREATE TABLE
  IF NOT EXISTS sale_history (
    id UUID PRIMARY KEY,
    data_id UUID NOT NULL,
    data_product_id UUID,
    sale_number SERIAL,
    timestamp TIMESTAMPTZ,
    operation HISTORY_OPERATION NOT NULL,
    operation_reason TEXT
  );

CREATE TABLE
  IF NOT EXISTS sale_data_search (
    data_id UUID NOT NULL,
    searchable_text TEXT NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS sale_data_search_idx ON sale_data_search (data_id);

CREATE TABLE
  IF NOT EXISTS sale_data (
    data_id UUID NOT NULL,
    sales_event_number INTEGER NOT NULL,
    student_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    final_sale_revenue NUMERIC(10, 2)
  );

CREATE UNIQUE INDEX IF NOT EXISTS sale_data_idx ON sale_data (data_id);

CREATE TABLE
  IF NOT EXISTS sale_data_product (
    data_product_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    product_number INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2)
  );

CREATE UNIQUE INDEX IF NOT EXISTS sale_data_product_idx ON sale_data_product (data_product_id, item_order);

CREATE TABLE
  IF NOT EXISTS sale_data_cardcom (
    data_cardcom_id UUID NOT NULL,
    response_json JSONB NOT NULL,
    invoice_number TEXT NOT NULL,
    terminal_number TEXT NOT NULL,
    approval_number TEXT NOT NULL,
    sale_timestamp TIMESTAMPTZ NOT NULL,
    user_email TEXT,
    coupon TEXT,
    internal_deal_number INTEGER,
    customer_id INTEGER
  );

CREATE UNIQUE INDEX IF NOT EXISTS sale_data_cardcom_idx ON sale_data_cardcom (data_cardcom_id);

CREATE INDEX IF NOT EXISTS sale_data_cardcom_customer_id_idx ON sale_data_cardcom (customer_id);

CREATE TABLE
  IF NOT EXISTS sale_data_manual (
    data_id UUID NOT NULL,
    cardcom_invoice_number TEXT
  );

CREATE UNIQUE INDEX IF NOT EXISTS sale_data_manual_idx ON sale_data_manual (data_id);