-- ========================================
-- SUPPLEMENT PROGRESS VIEW (PIVOT)
-- ========================================

-- Drop existing view if needed
DROP VIEW IF EXISTS supplement_progress_view;

CREATE OR REPLACE VIEW supplement_progress_view AS
SELECT 
    rpro,
    MAX(scan_date) as last_activity_date,
    MAX(created_at) as last_updated_at,
    
    -- Dán (Lamination)
    MAX(CASE WHEN section = 'Dán' AND action = 'IN' THEN created_at END) as dan_in,
    MAX(CASE WHEN section = 'Dán' AND action = 'OUT' THEN created_at END) as dan_out,
    
    -- Cắt (Prefitting)
    MAX(CASE WHEN section = 'Cắt' AND action = 'IN' THEN created_at END) as cat_in,
    MAX(CASE WHEN section = 'Cắt' AND action = 'OUT' THEN created_at END) as cat_out,
    
    -- Molding
    MAX(CASE WHEN section = 'Molding' AND action = 'IN' THEN created_at END) as molding_in,
    MAX(CASE WHEN section = 'Molding' AND action = 'OUT' THEN created_at END) as molding_out,
    
    -- Leanline DC
    MAX(CASE WHEN section = 'DC' AND action = 'IN' THEN created_at END) as dc_in,
    MAX(CASE WHEN section = 'DC' AND action = 'OUT' THEN created_at END) as dc_out,
    
    -- Leanline Molded
    MAX(CASE WHEN section = 'Molded' AND action = 'IN' THEN created_at END) as molded_in,
    MAX(CASE WHEN section = 'Molded' AND action = 'OUT' THEN created_at END) as molded_out

FROM supplement_tracking
GROUP BY rpro;

COMMENT ON VIEW supplement_progress_view IS 'Pivot table showing progress of each RPRO across all sections';
