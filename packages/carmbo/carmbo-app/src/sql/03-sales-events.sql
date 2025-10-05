CREATE TABLE
  IF NOT EXISTS sales_event (
    sales_event_number SERIAL PRIMARY KEY,
    last_history_id UUID,
    last_data_id UUID -- denormalized for performance
  );

CREATE TABLE
  IF NOT EXISTS sales_event_history (
    id UUID PRIMARY KEY,
    data_id UUID NOT NULL,
    sales_event_number SERIAL,
    timestamp TIMESTAMPTZ,
    operation HISTORY_OPERATION NOT NULL,
    operation_reason TEXT
  );

CREATE UNIQUE INDEX IF NOT EXISTS sales_event_history_idx ON sales_event_history (sales_event_number, timestamp, operation);

CREATE TABLE
  IF NOT EXISTS sales_event_search (
    data_id UUID NOT NULL,
    searchable_text TEXT NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS sales_event_search_idx ON sales_event_search (data_id);

CREATE TABLE
  IF NOT EXISTS sales_event_data (
    data_id UUID NOT NULL,
    name TEXT NOT NULL,
    from_date DATE,
    to_date DATE,
    landing_page_url TEXT
  );

CREATE UNIQUE INDEX IF NOT EXISTS sales_event_data_idx ON sales_event_data (data_id);

CREATE TABLE
  IF NOT EXISTS sales_event_product_for_sale (
    data_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    product_number INTEGER NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS sales_event_product_for_sale_idx ON sales_event_product_for_sale (data_id, item_order);