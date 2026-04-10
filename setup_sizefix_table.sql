-- Create table for Size Fix data to replace local JSON file
CREATE TABLE IF NOT EXISTS ovn_sizefix (
    rpro TEXT PRIMARY KEY,
    fix_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (optional, depends on your security setup)
-- ALTER TABLE ovn_sizefix ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access" ON ovn_sizefix FOR SELECT USING (true);
