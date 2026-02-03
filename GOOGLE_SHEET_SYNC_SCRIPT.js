/**
 * HƯỚNG DẪN SỬ DỤNG:
 * 1. Mở file Google Sheet của bạn.
 * 2. Vào menu "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 * 3. Xóa hết code cũ và dán toàn bộ đoạn code này vào.
 * 4. Nhấn "Lưu" (Save) và đặt tên là "SyncData".
 * 5. Nhấn nút "Run" để chạy thử lần đầu (Cần cấp quyền cho Google).
 * 6. Để tự động cập nhật: Vào phần "Kích hoạt" (Triggers - biểu tượng đồng hồ) 
 *    -> "Thêm trình kích hoạt" -> Chọn chạy "fetchDataFromSupabase" -> Theo thời gian (ví dụ: mỗi 15 hoặc 30 phút).
 */

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📊 Hệ Thống Bù Hàng')
        .addItem('🔄 Cập nhật dữ liệu từ Supabase', 'fetchDataFromSupabase')
        .addToUi();
}

function fetchDataFromSupabase() {
    const table = "supplement_confirm";
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc`;

    const options = {
        "method": "GET",
        "headers": {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY
        }
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());

        Logger.log("Số dòng lấy được: " + (data ? data.length : 0));

        if (data && data.length > 0) {
            updateSheet(data);
        } else {
            SpreadsheetApp.getUi().alert("⚠️ Không có dữ liệu nào trong bảng supplement_confirm để tải về.");
        }
    } catch (e) {
        Logger.log("Lỗi khi lấy dữ liệu: " + e.toString());
        SpreadsheetApp.getUi().alert("❌ Lỗi hệ thống: " + e.toString());
    }
}

function updateSheet(data) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Tiêu đề cột
    const headers = [
        "Ngày tạo", "RPRO ID", "S.O", "Khách hàng", "Gender", "Mã Khuôn",
        "Mã PU", "Mã Vải", "BOM", "Tổng Qty", "Số đôi đáp ứng", "Chi tiết Size", "Xác nhận Kho", "Ghi chú"
    ];

    // Chuẩn bị dữ liệu
    const rows = data.map(r => {
        // Format size breakdown
        let sizes = [];
        Object.keys(r).forEach(key => {
            if (key.startsWith('size_') && Number(r[key]) > 0) {
                const sizeName = key.replace('size_', '').replace(/_/g, '.');
                sizes.push(`${sizeName}: ${r[key]}`);
            }
        });
        const sizeText = sizes.join(', ');

        return [
            new Date(r.created_at).toLocaleString('vi-VN'),
            r.rpro,
            r.so || "",
            r.customers || "",
            r.gender || "",
            r.mold || "",
            r.pu || "",
            r.fabric || "",
            r.bom || "",
            r.total,
            r.available_supplement !== null ? r.available_supplement : r.total,
            sizeText,
            r.confirm || "CHỜ",
            r.remark || ""
        ];
    });

    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#e2e8f0");
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    // Auto resize columns
    sheet.autoResizeColumns(1, headers.length);

    SpreadsheetApp.getUi().alert("✅ Đã cập nhật xong dữ liệu mới nhất!");
}
