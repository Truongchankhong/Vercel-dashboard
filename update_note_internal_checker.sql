-- Thêm cột note vào bảng crosscheck_sample
ALTER TABLE crosscheck_sample 
ADD COLUMN IF NOT EXISTS note TEXT;

-- Thêm cột note vào bảng test_lab
ALTER TABLE test_lab 
ADD COLUMN IF NOT EXISTS note TEXT;

-- Thêm comment cho các cột
COMMENT ON COLUMN crosscheck_sample.note IS 'Ghi chú thêm khi xác nhận mẫu';
COMMENT ON COLUMN test_lab.note IS 'Ghi chú thêm khi xác nhận mẫu';
