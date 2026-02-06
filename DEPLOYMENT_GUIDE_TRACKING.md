# 🚀 Hướng Dẫn Triển Khai Hệ Thống Tracking Hàng Bù Realtime

## 📋 Tổng Quan
Hệ thống mới cung cấp:
- ✅ Tracking IN/OUT cho từng bộ phận
- ✅ Hỗ trợ cả Camera và Máy quét cầm tay
- ✅ Dashboard theo dõi Realtime
- ✅ Cảnh báo tự động khi đơn hàng quá 4 tiếng
- ✅ Lịch sử đầy đủ (log-based)

---

## 🗄️ BƯỚC 1: Cập Nhật Database (Supabase)

### 1.1. Truy cập Supabase Dashboard
- Đăng nhập vào: https://supabase.com
- Chọn project: `ixdtdrbytwdmnlqgunzu`

### 1.2. Tạo Bảng Mới
Vào **SQL Editor** và chạy file: `supplement_tracking_schema.sql`

Hoặc copy-paste nội dung sau:

```sql
-- Create tracking table
CREATE TABLE IF NOT EXISTS supplement_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rpro TEXT NOT NULL,
    section TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('IN', 'OUT')),
    operator TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scan_date DATE DEFAULT CURRENT_DATE
);

-- Indexes
CREATE INDEX idx_rpro ON supplement_tracking(rpro);
CREATE INDEX idx_section ON supplement_tracking(section);
CREATE INDEX idx_created_at ON supplement_tracking(created_at);

-- Enable RLS
ALTER TABLE supplement_tracking ENABLE ROW LEVEL SECURITY;

-- Policy (allow all for now)
CREATE POLICY "Allow all" ON supplement_tracking FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE supplement_tracking;
```

### 1.3. Kiểm Tra
Vào **Table Editor** → Xem bảng `supplement_tracking` đã được tạo chưa.

---

## 📁 BƯỚC 2: Upload Files Mới

Các file đã được tạo:
1. `supplement_tracking_schema.sql` - SQL schema
2. `public/supplement-count.html` - Trang quét mới
3. `public/supplement-count.js` - Logic quét mới
4. `public/supplement-monitor.html` - Dashboard theo dõi
5. `public/supplement-monitor.js` - Logic dashboard

### 2.1. Commit và Push
```bash
git add .
git commit -m "feat: Add Realtime Tracking System"
git push
```

### 2.2. Deploy lên Vercel
Vercel sẽ tự động deploy sau khi push.

---

## 🧪 BƯỚC 3: Kiểm Tra Chức Năng

### 3.1. Test Scan và Tracking
1. Mở: `supplement-count.html`
2. Chọn bộ phận (ví dụ: Dán)
3. Chọn hành động: **IN**
4. Quét mã RPRO (hoặc dùng máy quét cầm tay)
5. Kiểm tra thông báo: "✅ NHẬP VÀO: RPRO..."

### 3.2. Test Validation Logic
1. Quét lại cùng mã RPRO với action **IN**
   → **Kỳ vọng**: ⚠️ Cảnh báo "Đã IN rồi!"
2. Chuyển sang action **OUT** và quét lại
   → **Kỳ vọng**: ✅ Thành công
3. Tiếp tục quét lại với **OUT**
   → **Kỳ vọng**: ⚠️ Cảnh báo "Đã OUT rồi!"

### 3.3. Test Dashboard Realtime
1. Mở: `supplement-monitor.html` (trên tab khác)
2. Quay lại `supplement-count.html` và quét mã mới với **IN**
3. Xem Dashboard tự động cập nhật KHÔNG CẦN LÀM MỚI

### 3.4. Test Máy Quét Cầm Tay
1. Không cần click vào ô input
2. Chỉ cần quét trực tiếp bằng máy quét
3. Mã sẽ tự động được xử lý

### 3.5. Test Cảnh Báo 4 Tiếng
*(Cần đợi thực tế hoặc sửa thời gian trong database thủ công)*

---

## 🔧 BƯỚC 4: Tùy Chỉnh (Tùy Chọn)

### 4.1. Đổi Ngưỡng Cảnh Báo (mặc định 4 giờ)
File: `supplement-monitor.js`
```javascript
// Tìm dòng:
const isWarning = elapsedHours > 4;

// Đổi thành (ví dụ 2 giờ):
const isWarning = elapsedHours > 2;
```

### 4.2. Thêm Thông Tin Operator (Người Quét)
Nếu bạn có hệ thống login, sửa file `supplement-count.js`:
```javascript
// Tìm dòng:
operator: 'User'

// Đổi thành:
operator: getCurrentUserName() // Hàm lấy username
```

### 4.3. Thêm Bộ Phận Mới
File: `supplement-count.html`
```html
<!-- Thêm button mới -->
<button class="section-btn ..." data-section="TÊN_MỚI">
    🎯 Tên Bộ Phận Mới
</button>
```

---

## 📊 BƯỚC 5: Sử Dụng Hằng Ngày

### Quy trình chuẩn:
1. Người scan mở: `supplement-count.html`
2. Chọn bộ phận đang làm việc
3. Khi đơn hàng **vào** → Chọn **IN** và quét
4. Khi đơn hàng **ra** → Chọn **OUT** và quét
5. Quản lý mở: `supplement-monitor.html` để theo dõi

### Lợi ích:
- ✅ Biết đơn hàng đang ở đâu
- ✅ Cảnh báo delay tự động
- ✅ Lịch sử đầy đủ
- ✅ Không cần refresh, tự động cập nhật

---

## ⚠️ Lưu Ý Quan Trọng

### Máy Quét Cầm Tay
- Không cần click vào ô input
- Đảm bảo trang web đang focus (không chuyển tab)
- Máy quét phải cấu hình **Enter** sau mỗi lần quét

### Camera Scanner
- iPhone/Safari: Cần đưa camera ra xa rồi lại gần để focus
- Cho phép quyền camera khi trình duyệt hỏi
- Chrome/Edge hoạt động tốt nhất

### Realtime
- Cần kết nối internet ổn định
- Nếu không tự động cập nhật → Bấm nút "🔄 Làm mới"

---

## 🆘 Troubleshooting

### Lỗi: "❌ Lỗi hệ thống"
→ Kiểm tra Console (F12) để xem chi tiết
→ Kiểm tra connection đến Supabase

### Dashboard không realtime
→ Kiểm tra đã enable Realtime cho bảng chưa (Bước 1.2)
→ Reload trang và xem Console

### Máy quét không hoạt động
→ Kiểm tra trang web có đang focus không
→ Test bằng cách quét vào Notepad trước

---

## 📞 Hỗ Trợ
Nếu gặp vấn đề, cung cấp:
1. Screenshot màn hình
2. Console log (F12 → Console tab)
3. Mô tả chi tiết bước làm

---

**Chúc triển khai thành công! 🎉**
