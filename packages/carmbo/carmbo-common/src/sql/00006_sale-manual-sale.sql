CREATE TABLE IF NOT EXISTS sale_info_manual (
  sale_number INTEGER NOT NULL,
  cardcom_invoice_number TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_info_manual_idx ON sale_info_manual (sale_number);
