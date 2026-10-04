CREATE TABLE IF NOT EXISTS product_integration_skool (
    data_id UUID NOT NULL,
    send_invitation BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS product_integration_skool_idx ON product_integration_skool (data_id);
