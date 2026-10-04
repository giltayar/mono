ALTER TYPE SALE_HISTORY_OPERATION ADD VALUE 'connect-sale';

COMMIT;

UPDATE sale_history
SET
  operation = 'connect-sale'
WHERE
  operation = 'connect-manual-sale';
