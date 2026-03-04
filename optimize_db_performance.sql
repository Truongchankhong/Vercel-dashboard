
-- ========================================================
-- TỐI ƯU HÓA DATABASE CHO DASHBOARD
-- Chạy đoạn script này trong Supabase SQL Editor để tăng tốc tìm kiếm
-- ========================================================

-- 1. Index cho bảng Masterdata
CREATE INDEX IF NOT EXISTS idx_masterdata_pro_oder ON "Masterdata" ("PRO ODER");
CREATE INDEX IF NOT EXISTS idx_masterdata_pu_description ON "Masterdata" ("PU DESCRIPTION");
CREATE INDEX IF NOT EXISTS idx_masterdata_fb_description ON "Masterdata" ("FB DESCRIPTION");

-- 2. Index cho bảng powerapp
CREATE INDEX IF NOT EXISTS idx_powerapp_pro_oder ON "powerapp" ("PRO ODER");
CREATE INDEX IF NOT EXISTS idx_powerapp_pu_description ON "powerapp" ("PU DESCRIPTION");
CREATE INDEX IF NOT EXISTS idx_powerapp_fb_description ON "powerapp" ("FB DESCRIPTION");

-- 3. (Tùy chọn) Index cho bảng hàng dư
CREATE INDEX IF NOT EXISTS idx_surplusgoods_rpro ON "surplusgoods" ("rpro");
CREATE INDEX IF NOT EXISTS idx_surplusgoods_pu ON "surplusgoods" ("pu");
CREATE INDEX IF NOT EXISTS idx_surplusgoods_fabric ON "surplusgoods" ("fabric");
