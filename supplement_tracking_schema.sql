-- ========================================
-- SUPPLEMENT TRACKING REALTIME SCHEMA
-- ========================================

-- Drop existing table if you want fresh start (CAREFUL!)
-- DROP TABLE IF EXISTS supplement_tracking CASCADE;

-- Create new tracking table with log-based structure
CREATE TABLE IF NOT EXISTS supplement_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rpro TEXT NOT NULL,
    section TEXT NOT NULL,  -- 'Dán', 'Cắt', 'Molding', 'DC', 'Molded'
    action TEXT NOT NULL CHECK (action IN ('IN', 'OUT')),  -- IN or OUT
    operator TEXT,  -- Username or ID of person who scanned
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata for easy queries
    scan_date DATE DEFAULT CURRENT_DATE,
    
    -- Indexes for performance
    INDEX idx_rpro (rpro),
    INDEX idx_section (section),
    INDEX idx_created_at (created_at),
    INDEX idx_scan_date (scan_date)
);

-- Enable Row Level Security (Optional)
ALTER TABLE supplement_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated users" 
ON supplement_tracking 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE supplement_tracking;

-- ========================================
-- HELPER VIEW: Current Status of Orders
-- ========================================
CREATE OR REPLACE VIEW supplement_current_status AS
WITH latest_actions AS (
    SELECT DISTINCT ON (rpro, section)
        rpro,
        section,
        action,
        created_at,
        operator
    FROM supplement_tracking
    ORDER BY rpro, section, created_at DESC
)
SELECT 
    rpro,
    section,
    action as current_status,
    created_at as last_updated,
    operator as last_operator,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS hours_since_update
FROM latest_actions
WHERE action = 'IN'  -- Only show orders currently IN a section
ORDER BY created_at ASC;

COMMENT ON VIEW supplement_current_status IS 'Shows orders currently IN a section with time elapsed';
