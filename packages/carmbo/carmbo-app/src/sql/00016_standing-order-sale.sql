-- sale_type
-------------
CREATE TYPE SALE_TYPE AS ENUM ('one-time', 'standing-order');

ALTER TABLE sale_data
ADD COLUMN sale_type SALE_TYPE;

UPDATE sale_data
SET
  sale_type = 'one-time';

ALTER TABLE sale_data
ALTER COLUMN sale_type
SET
  NOT NULL;

-- final_sale_revenue should come from sale_data_cardcom and sale_data_cardcom_manual
-----------------------------------------------------------------------------
ALTER TABLE sale_data DROP COLUMN final_sale_revenue;

-- standing order active flag
-----------------------------
CREATE TABLE
  sale_data_active (
    data_active_id UUID PRIMARY KEY,
    is_active BOOLEAN NOT NULL
  );

ALTER TABLE sale_history
ADD COLUMN data_active_id UUID;

-- sale_data_cardcom fields we're not using
-------------------------------------------
ALTER TABLE sale_data_cardcom
DROP COLUMN approval_number,
DROP COLUMN terminal_number,
DROP COLUMN sale_timestamp,
DROP COLUMN user_email;

-- sale_data_cardcom recurring order id
---------------------------------------
ALTER TABLE sale_data_cardcom
ADD COLUMN recurring_order_id TEXT;

CREATE UNIQUE INDEX sale_data_cardcom_recurring_order_id_idx ON sale_data_cardcom (recurring_order_id);


-- standing order payments
--------------------------
CREATE TYPE STANDING_ORDER_PAYMENT_RESOLUTION AS ENUM ('payed', 'failure-but-retrying', 'failed', 'on-hold');

CREATE TABLE
  sale_standing_order_payments (
    id UUID PRIMARY KEY,
    sale_number INTEGER NOT NULL,
    sale_data_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    payment_revenue NUMERIC(10, 2) NOT NULL,
    resolution STANDING_ORDER_PAYMENT_RESOLUTION NOT NULL
  );

CREATE INDEX sale_standing_order_payments_sale_data_id_idx ON sale_standing_order_payments (sale_data_id);

ALTER TABLE sale_data_cardcom
ADD COLUMN recurring_id TEXT;

CREATE TABLE
  sale_standing_order_cardcom_recurring_payment (
    sale_standing_order_payment_id UUID NOT NULL,
    status TEXT NOT NULL,
    invoice_document_number TEXT,
    internal_deal_number INTEGER
  );


CREATE UNIQUE INDEX sale_standing_order_cardcom_recurring_payment_idx ON sale_standing_order_cardcom_recurring_payment (sale_standing_order_payment_id);
