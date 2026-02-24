-- Add so_tam column to supplement_confirm table
ALTER TABLE supplement_confirm ADD COLUMN IF NOT EXISTS "so_tam" numeric;
