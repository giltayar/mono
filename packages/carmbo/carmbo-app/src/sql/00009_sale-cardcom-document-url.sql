ALTER TABLE sale_data_cardcom
ADD COLUMN invoice_document_url TEXT;

ALTER TABLE sale_data_manual
ADD COLUMN invoice_document_url TEXT;

ALTER TABLE sale_data_manual
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

ALTER TABLE sale_data_manual
ADD COLUMN data_manual_id UUID;

UPDATE sale_data_manual
SET
  data_manual_id = data_id;

ALTER TABLE sale_data_manual
DROP COLUMN data_id;

ALTER TYPE SALE_OPERATION ADD VALUE 'update';

CREATE TYPE SALE_OPERATION ADD VALUE 'delete';

CREATE TYPE SALE_OPERATION ADD VALUE 'restore';

CREATE TYPE SALE_OPERATION ADD VALUE 'create-tax-invoice-document';