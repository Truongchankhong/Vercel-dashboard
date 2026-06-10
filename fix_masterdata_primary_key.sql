-- =====================================================================
-- FIX DỰ LIỆU TRÙNG LẶP VÀ ĐỔI PRIMARY KEY BẢNG MASTERDATA
-- Hướng dẫn: Chạy script này trong Supabase SQL Editor
-- =====================================================================

-- 1. Xóa tất cả dòng trùng lặp của "PRO ODER", giữ lại dòng có "STT" lớn nhất
DELETE FROM "Masterdata"
WHERE "STT" NOT IN (
    SELECT MAX("STT")
    FROM "Masterdata"
    GROUP BY "PRO ODER"
);

-- 2. Xóa bỏ ràng buộc Khóa chính (Primary Key) cũ trên cột "STT"
ALTER TABLE "Masterdata" DROP CONSTRAINT IF EXISTS "Masterdata_pkey";

-- 3. Đặt cột "PRO ODER" thành NOT NULL (bắt buộc đối với Khóa chính)
ALTER TABLE "Masterdata" ALTER COLUMN "PRO ODER" SET NOT NULL;

-- 4. Đặt cột "PRO ODER" làm Khóa chính (Primary Key) mới
ALTER TABLE "Masterdata" ADD CONSTRAINT "Masterdata_pkey" PRIMARY KEY ("PRO ODER");

-- 5. Tối ưu hóa lại bảng dữ liệu
VACUUM ANALYZE "Masterdata";
