ALTER TABLE sale_standing_order_cardcom_recurring_payment
ADD COLUMN invoice_document_url TEXT;

ALTER TABLE sale_data_cardcom
DROP COLUMN recurring_id;

ALTER TABLE sale_standing_order_payments
ADD COLUMN is_first_payment BOOLEAN;

UPDATE sale_standing_order_payments
SET is_first_payment = TRUE;

ALTER TABLE sale_standing_order_payments
ALTER COLUMN is_first_payment
SET
  NOT NULL;
