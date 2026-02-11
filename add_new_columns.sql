-- ============================================================
-- ADD NEW COLUMNS TO powerapp TABLE (Feb 2026 Update)
-- Run this in Supabase SQL Editor
-- ============================================================

-- New tracking columns
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "SubIFM" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Returned Line" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "KHO TAM" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Instruction Skiving" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Article Code" text;

-- New size columns (sizes 1, 1.5, 2, 2.5)
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "1" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "1.5" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "2" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "2.5" numeric;

-- Youth sizes
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "3.5Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "4Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "4.5Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "5Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "5.5Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "6Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "6.5Y" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "7Y" numeric;

-- Kids sizes
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "10K" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "10.5K" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "11K" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "11.5K" numeric;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "12K" numeric;

-- Material tracking
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "NG Fabric" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Inventory_Logo_Inhouse" text;

-- Check columns
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Check2" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "CheckLL" text;

-- PPC date tracking columns
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "loadMaterial PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Lamination PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "Sawcutting PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "TachBao PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "SUB PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "MOLDING PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "INLEANLINE PPC" text;
ALTER TABLE powerapp ADD COLUMN IF NOT EXISTS "OUTLEANLINE PPC" text;

-- ============================================================
-- ALSO ADD TO Masterdata TABLE (backup of 9.STORED orders)
-- ============================================================
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "SubIFM" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Returned Line" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "KHO TAM" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Instruction Skiving" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Article Code" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "1" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "1.5" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "2" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "2.5" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "3.5Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "4Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "4.5Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "5Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "5.5Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "6Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "6.5Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "7Y" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "10K" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "10.5K" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "11K" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "11.5K" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "12K" numeric;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "NG Fabric" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Inventory_Logo_Inhouse" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Check2" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "CheckLL" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "loadMaterial PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Lamination PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "Sawcutting PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "TachBao PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "SUB PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "MOLDING PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "INLEANLINE PPC" text;
ALTER TABLE "Masterdata" ADD COLUMN IF NOT EXISTS "OUTLEANLINE PPC" text;
