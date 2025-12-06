ALTER TABLE sale_data_cardcom ADD COLUMN cardcom_sale_revenue numeric(10, 2);
ALTER TABLE sale_data_cardcom_manual ADD COLUMN cardcom_sale_revenue numeric(10, 2);

UPDATE sale_data_cardcom_manual sdm
SET cardcom_sale_revenue = sd.final_sale_revenue
FROM sale_data sd
JOIN sale_history sh ON sd.data_id = sh.data_id
WHERE
  sh.data_manual_id = sdm.data_manual_id;

UPDATE sale_data_cardcom sdc
SET cardcom_sale_revenue = sd.final_sale_revenue
FROM sale_data sd
JOIN sale_history sh ON sd.data_id = sh.data_id
JOIN sale s ON s.last_history_id = sh.id
WHERE
  s.data_cardcom_id = sdc.data_cardcom_id;

