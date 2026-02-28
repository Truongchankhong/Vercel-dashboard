-- SQL Script for creating the Surplusgoods table in Supabase.
-- Please copy and run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS Surplusgoods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    rpro TEXT NOT NULL,
    so TEXT,
    brand_code TEXT,
    mold TEXT,
    bom TEXT,
    pu TEXT,
    fabric TEXT,
    note TEXT,
    
    -- Size columns #3 to #15 (0.5 increments)
    size_3 FLOAT8 DEFAULT 0,
    size_3_5 FLOAT8 DEFAULT 0,
    size_4 FLOAT8 DEFAULT 0,
    size_4_5 FLOAT8 DEFAULT 0,
    size_5 FLOAT8 DEFAULT 0,
    size_5_5 FLOAT8 DEFAULT 0,
    size_6 FLOAT8 DEFAULT 0,
    size_6_5 FLOAT8 DEFAULT 0,
    size_7 FLOAT8 DEFAULT 0,
    size_7_5 FLOAT8 DEFAULT 0,
    size_8 FLOAT8 DEFAULT 0,
    size_8_5 FLOAT8 DEFAULT 0,
    size_9 FLOAT8 DEFAULT 0,
    size_9_5 FLOAT8 DEFAULT 0,
    size_10 FLOAT8 DEFAULT 0,
    size_10_5 FLOAT8 DEFAULT 0,
    size_11 FLOAT8 DEFAULT 0,
    size_11_5 FLOAT8 DEFAULT 0,
    size_12 FLOAT8 DEFAULT 0,
    size_12_5 FLOAT8 DEFAULT 0,
    size_13 FLOAT8 DEFAULT 0,
    size_13_5 FLOAT8 DEFAULT 0,
    size_14 FLOAT8 DEFAULT 0,
    size_14_5 FLOAT8 DEFAULT 0,
    size_15 FLOAT8 DEFAULT 0,
    
    -- Column for dynamic storage of other special sizes
    dynamic_sizes JSONB DEFAULT '{}'::jsonb
);

-- RLS Configuration
ALTER TABLE Surplusgoods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON Surplusgoods;
CREATE POLICY "Public Full Access" ON Surplusgoods FOR ALL USING (true);
