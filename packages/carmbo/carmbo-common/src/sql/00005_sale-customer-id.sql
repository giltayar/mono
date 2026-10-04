ALTER TABLE sale_info_cardcom
ADD COLUMN IF NOT EXISTS internal_deal_number INTEGER;

ALTER TABLE sale_info_cardcom
ADD COLUMN IF NOT EXISTS customer_id INTEGER;

CREATE INDEX IF NOT EXISTS sale_info_cardcom_customer_id_idx ON sale_info_cardcom (customer_id);