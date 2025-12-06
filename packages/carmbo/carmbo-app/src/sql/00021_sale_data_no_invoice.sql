CREATE TABLE sale_data_no_invoice (
    data_no_invoice_id UUID NOT NULL,
    sale_revenue INTEGER NOT NULL
);

ALTER TABLE sale ADD COLUMN data_no_invoice_id UUID;
