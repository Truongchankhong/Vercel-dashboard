-- 1. Add 'note' column if not exists
ALTER TABLE supplement_tracking ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. Update action constraint to allow 'NOTE'
-- First, find the constraint name. In Supabase/PostgreSQL, it's often 'supplement_tracking_action_check'
ALTER TABLE supplement_tracking DROP CONSTRAINT IF EXISTS supplement_tracking_action_check;
ALTER TABLE supplement_tracking ADD CONSTRAINT supplement_tracking_action_check CHECK (action IN ('IN', 'OUT', 'NOTE'));

-- 3. Add quantity column if not exists (used in JS but might be missing in some old schemas)
ALTER TABLE supplement_tracking ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1;

COMMENT ON COLUMN supplement_tracking.action IS 'Action types: IN, OUT, or NOTE for section-specific notes';
