-- Update table to support monthly historical data
-- 1. Add month_key column
ALTER TABLE ovn_bonus_data ADD COLUMN IF NOT EXISTS month_key TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');

-- 2. Drop old constraint if exists (id was PK, row_no was unique)
ALTER TABLE ovn_bonus_data DROP CONSTRAINT IF EXISTS ovn_bonus_data_row_no_key;

-- 3. Add new unique constraint for Row + Month
ALTER TABLE ovn_bonus_data ADD CONSTRAINT ovn_bonus_data_row_month_unique UNIQUE (row_no, month_key);

-- 4. Set current month for existing data if they don't have one
UPDATE ovn_bonus_data SET month_key = to_char(CURRENT_DATE, 'YYYY-MM') WHERE month_key IS NULL;
