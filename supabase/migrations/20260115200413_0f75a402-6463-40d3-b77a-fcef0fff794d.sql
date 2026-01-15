-- Remove remaining public role policies that allow unauthenticated access

-- distribution_product_aliases - remove public role insert/update policies
DROP POLICY IF EXISTS "Authenticated users can insert aliases" ON distribution_product_aliases;
DROP POLICY IF EXISTS "Authenticated users can update aliases" ON distribution_product_aliases;