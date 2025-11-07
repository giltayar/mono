CREATE TYPE CARDCOM_SALE_TYPE AS ENUM ('ONE_TIME', 'RECURRING');

ALTER TABLE sale_data_cardcom
ADD COLUMN sale_type CARDCOM_SALE_TYPE;

UPDATE sale_data_cardcom
SET
  sale_type = 'ONE_TIME';

ALTER TABLE sale_data_cardcom
ALTER COLUMN sale_type
SET
  NOT NULL;

ALTER TABLE sale_data_cardcom
ADD COLUMN recurring_id text;

ALTER TABLE sale_data_cardcom
ADD COLUMN price_per_month NUMBER (10, 2);

ALTER TABLE sale_data_cardcom
ADD COLUMN product_number INTEGER;

CREATE TABLE
  sale_data_cardcom_recurring_payment (
    data_cardcom_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    cardcom_row_id INTEGER NOT NULL,
    payment_number INTEGER NOT NULL,
    product_number INTEGER NOT NULL,
    response_json JSONB NOT NULL,
    status TEXT NOT NULL,
    bill_date TIMESTAMPTZ NOT NULL,
    original_bill_date TIMESTAMPTZ NOT NULL,
    billing_attempts INTEGER NOT NULL,
    invoice_document_number TEXT,
    internal_deal_number INTEGER
  );