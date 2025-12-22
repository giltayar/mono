CREATE TABLE
  sale_data_connected (
    data_connected_id UUID PRIMARY KEY,
    is_connected BOOLEAN NOT NULL
  );

ALTER TABLE sale_history
ADD COLUMN data_connected_id UUID;

