ALTER TABLE sale_data_cardcom
ADD COLUMN invoice_document_url TEXT;

ALTER TABLE sale_data_cardcom_manual
ADD COLUMN invoice_document_url TEXT;

ALTER TABLE sale_data_cardcom_manual
ADD COLUMN cardcom_customer_id INTEGER;

ALTER TABLE sale
ADD COLUMN last_data_manual_id UUID;

UPDATE sale
SET
  last_data_manual_id = last_data_id;

ALTER TABLE sale_history
ADD COLUMN data_manual_id UUID;

UPDATE sale_history
SET
  data_manual_id = data_id;

ALTER TABLE sale_data_cardcom_manual
ADD COLUMN data_manual_id UUID;

UPDATE sale_data_cardcom_manual
SET
  data_manual_id = data_id;

ALTER TABLE sale_data_cardcom_manual
DROP COLUMN data_id;

DROP TYPE SALE_OPERATION;

CREATE TYPE SALE_HISTORY_OPERATION AS ENUM ('create', 'update', 'delete', 'restore', 'create-tax-invoice-document');

ALTER TABLE sale_history
ALTER COLUMN operation TYPE SALE_HISTORY_OPERATION USING operation::text::SALE_HISTORY_OPERATION;