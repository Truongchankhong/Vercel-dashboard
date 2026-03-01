-- Run this in Supabase SQL Editor to add Code columns to Surplusgoods table
ALTER TABLE Surplusgoods ADD COLUMN IF NOT EXISTS pu_code TEXT;
ALTER TABLE Surplusgoods ADD COLUMN IF NOT EXISTS fb_code TEXT;
