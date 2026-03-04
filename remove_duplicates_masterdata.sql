
-- ========================================================
-- XÓA DỮ LIỆU TRÙNG LẶP TRONG BẢNG MASTERDATA
-- Giữ lại dòng có STT lớn nhất (mới nhất) cho mỗi mã PRO ODER
-- ========================================================

DELETE FROM "Masterdata"
WHERE "STT" NOT IN (
    SELECT MAX("STT")
    FROM "Masterdata"
    GROUP BY "PRO ODER"
);

-- Sau khi xóa xong, bạn nên chạy lệnh này để tối ưu lại bảng
VACUUM ANALYZE "Masterdata";
