-- Create table for Bonus Dashboard persistence
CREATE TABLE IF NOT EXISTS ovn_bonus_data (
    id SERIAL PRIMARY KEY,
    row_no INTEGER UNIQUE NOT NULL,
    index_name TEXT,
    value_text TEXT DEFAULT '0',
    unit_text TEXT,
    level_selected TEXT,
    note_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial data for 10 rows
INSERT INTO ovn_bonus_data (row_no, index_name, unit_text, level_selected)
VALUES 
(1, 'Mục tiêu sản lượng', 'Pair', NULL),
(2, 'Tổng sản lượng thực tế', 'Pair', 'Level 1'),
(3, 'Hiệu suất thực tế PPH_SMV', 'Pair/hours', 'Level 1'),
(4, 'Hàng làm lại', '%', 'Level 1'),
(5, 'Giao hàng đúng tiến độ', '%', 'Level 1'),
(6, 'Hàng phế', '%', 'Level 1'),
(7, 'Khiếu nại từ khách hàng', '%', 'Level 1'),
(8, 'Thời gian tăng ca', 'Hours', NULL),
(9, 'Sản lượng tối thiểu SMV', 'Pairs', 'Level 3'),
(10, 'Tổng số ngày làm việc', 'Days', NULL)
ON CONFLICT (row_no) DO NOTHING;
