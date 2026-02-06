-- ========================================
-- UPDATE SCHEMA: ADD QUANTITY & GAP
-- ========================================

-- 1. Add quantity column to tracking table
ALTER TABLE supplement_tracking 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;

-- 2. Update Progress View (Optional, but good for reference)
-- We strictly use client-side pivoting in JS now, but updating the view is good practice
DROP VIEW IF EXISTS supplement_progress_view;

CREATE OR REPLACE VIEW supplement_progress_view AS
SELECT 
    rpro,
    MAX(scan_date) as last_activity_date,
    MAX(created_at) as last_updated_at,
    
    -- Dán (Lamination)
    MAX(CASE WHEN section = 'Dán' AND action = 'IN' THEN created_at END) as dan_in_time,
    MAX(CASE WHEN section = 'Dán' AND action = 'IN' THEN quantity END) as dan_in_qty,
    MAX(CASE WHEN section = 'Dán' AND action = 'OUT' THEN created_at END) as dan_out_time,
    MAX(CASE WHEN section = 'Dán' AND action = 'OUT' THEN quantity END) as dan_out_qty,
    
    -- Cắt (Prefitting)
    MAX(CASE WHEN section = 'Cắt' AND action = 'IN' THEN created_at END) as cat_in_time,
    MAX(CASE WHEN section = 'Cắt' AND action = 'IN' THEN quantity END) as cat_in_qty,
    MAX(CASE WHEN section = 'Cắt' AND action = 'OUT' THEN created_at END) as cat_out_time,
    MAX(CASE WHEN section = 'Cắt' AND action = 'OUT' THEN quantity END) as cat_out_qty,
    
    -- Molding
    MAX(CASE WHEN section = 'Molding' AND action = 'IN' THEN created_at END) as molding_in_time,
    MAX(CASE WHEN section = 'Molding' AND action = 'IN' THEN quantity END) as molding_in_qty,
    MAX(CASE WHEN section = 'Molding' AND action = 'OUT' THEN created_at END) as molding_out_time,
    MAX(CASE WHEN section = 'Molding' AND action = 'OUT' THEN quantity END) as molding_out_qty,
    
    -- Leanline DC
    MAX(CASE WHEN section = 'DC' AND action = 'IN' THEN created_at END) as dc_in_time,
    MAX(CASE WHEN section = 'DC' AND action = 'IN' THEN quantity END) as dc_in_qty,
    MAX(CASE WHEN section = 'DC' AND action = 'OUT' THEN created_at END) as dc_out_time,
    MAX(CASE WHEN section = 'DC' AND action = 'OUT' THEN quantity END) as dc_out_qty,
    
    -- Leanline Molded
    MAX(CASE WHEN section = 'Molded' AND action = 'IN' THEN created_at END) as molded_in_time,
    MAX(CASE WHEN section = 'Molded' AND action = 'IN' THEN quantity END) as molded_in_qty,
    MAX(CASE WHEN section = 'Molded' AND action = 'OUT' THEN created_at END) as molded_out_time,
    MAX(CASE WHEN section = 'Molded' AND action = 'OUT' THEN quantity END) as molded_out_qty

FROM supplement_tracking
GROUP BY rpro;

COMMENT ON VIEW supplement_progress_view IS 'Updated pivot view with Quantity';
