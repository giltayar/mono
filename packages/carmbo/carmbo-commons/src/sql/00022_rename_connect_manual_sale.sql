ALTER TYPE SALE_HISTORY_OPERATION ADD VALUE 'connect-sale';

COMMIT AND CHAIN;

UPDATE sale_history
SET
  operation = 'connect-sale'
WHERE
  operation = 'connect-manual-sale';
