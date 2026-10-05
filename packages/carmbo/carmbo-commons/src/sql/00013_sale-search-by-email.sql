UPDATE sale_data_search sds
SET
  searchable_text = searchable_text || se.email
FROM
  sale_data sd
  JOIN student s ON s.student_number = sd.student_number
  JOIN student_history sh ON sh.id = s.last_history_id
  JOIN student_email se ON se.data_id = sh.data_id
WHERE
  sd.data_id = sds.data_id
