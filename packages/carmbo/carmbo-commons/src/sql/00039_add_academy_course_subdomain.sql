ALTER TABLE product_academy_course ADD COLUMN account_subdomain TEXT NOT NULL DEFAULT 'carmel';
ALTER TABLE product_academy_course ALTER COLUMN account_subdomain DROP DEFAULT;
