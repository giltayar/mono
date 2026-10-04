ALTER TABLE sale_data_cardcom
ADD COLUMN refund_transaction_id TEXT NULL;

ALTER TABLE sale_data_cardcom_manual
ADD COLUMN refund_transaction_id TEXT NULL;
