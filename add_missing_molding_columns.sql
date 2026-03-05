-- Thêm các cột còn thiếu cho tính năng MOLDING trong trang quản lý hàng dư
ALTER TABLE surplusgoods ADD COLUMN IF NOT EXISTS pu_code TEXT;
ALTER TABLE surplusgoods ADD COLUMN IF NOT EXISTS fb_code TEXT;

-- Index để tìm kiếm nhanh hơn theo code (sau này nếu cần)
CREATE INDEX IF NOT EXISTS idx_surplusgoods_pu_code ON surplusgoods (pu_code);
CREATE INDEX IF NOT EXISTS idx_surplusgoods_fb_code ON surplusgoods (fb_code);
