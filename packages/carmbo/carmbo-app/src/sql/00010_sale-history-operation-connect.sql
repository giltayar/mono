ALTER TYPE SALE_HISTORY_OPERATION ADD VALUE 'connect-manual-sale';

COMMIT;

UPDATE sale_history
SET
  operation = 'connect-manual-sale'
WHERE
  operation = 'create-tax-invoice-document';