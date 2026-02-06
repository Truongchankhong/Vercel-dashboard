-- Add 'note' column to supplement_tracking table
ALTER TABLE supplement_tracking 
ADD COLUMN IF NOT EXISTS note TEXT;
