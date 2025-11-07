-- sale_type
-------------
CREATE TYPE SALE_TYPE AS ENUM ('one-time', 'standing-order',);

ALTER TABLE sale_data
ADD COLUMN sale_type SALE_TYPE;

UPDATE sale_data
SET
  sale_type = 'one-time';

ALTER TABLE sale_data
ALTER COLUMN sale_type
SET
  NOT NULL;

-- final_sale_revenue nullable
------------------------------
ALTER TABLE sale_data
ALTER COLUMN final_sale_revenue
SET
  NULL;

-- standing order active flag
-----------------------------
CREATE TABLE
  sale_standing_order_active (
    standing_order_active_id UUID PRIMARY KEY,
    is_active BOOLEAN NOT NULL
  );

ALTER TABLE sale_history
ADD COLUMN standing_order_active_id UUID;

-- sale_data_cardcom fields we're not using
-------------------------------------------
ALTER TABLE sale_data_cardcom
DROP COLUMN approval_number,
terminal_number,
sale_timestamp,
user_email;

-- standing order payments
--------------------------
CREATE TYPE STANDING_ORDER_PAYMENT_RESOLUTION AS ENUM ('payed', 'failure-but-retrying', 'failed');

CREATE TABLE
  sale_standing_order_payments (
    id UUID PRIMARY KEY,
    sale_number INTEGER NOT NULL,
    sale_data_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    payment_revenue NUMERIC(10, 2) NOT NULL,
    resolution STANDING_ORDER_PAYMENT_RESOLUTION NOT NULL,
    response_json JSONB
  );

ALTER TABLE sale_data_cardcom
ADD COLUMN recurring_id TEXT;

CREATE TABLE
  sale_data_cardcom_recurring_payment (
    sale_standing_order_payment_id UUID NOT NULL,
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