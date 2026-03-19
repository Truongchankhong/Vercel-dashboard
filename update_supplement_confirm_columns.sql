-- SQL to add missing columns to supplement_confirm table
-- Run this in the Supabase SQL Editor

ALTER TABLE public.supplement_confirm 
ADD COLUMN IF NOT EXISTS available_supplement numeric,
ADD COLUMN IF NOT EXISTS id bigint,
ADD COLUMN IF NOT EXISTS fb text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS size_1 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_1_5 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_2 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_2_5 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "size_134.9mm*355mm" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "size_134.9mm*390mm" numeric DEFAULT 0;
