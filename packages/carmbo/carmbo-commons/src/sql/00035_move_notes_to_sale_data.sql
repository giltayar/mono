ALTER TABLE sale_data ADD COLUMN notes TEXT;

UPDATE sale_data
SET notes = sdcm.notes
FROM sale s
JOIN sale_history sh ON sh.id = s.last_history_id
JOIN sale_data_cardcom_manual sdcm ON sdcm.data_manual_id = sh.data_manual_id
WHERE sale_data.data_id = sh.data_id
  AND sdcm.notes IS NOT NULL;

ALTER TABLE sale_data_cardcom_manual DROP COLUMN notes;
