import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateExcel() {
    const workbook = new ExcelJS.Workbook();
    
    // Style configurations
    const FONT_FAMILY = 'Segoe UI';
    const COLOR_TITLE_DARK_BLUE = 'FF1B365D';
    const COLOR_HEADER_NAVY = 'FF2B579A';
    const COLOR_SECTION_LIGHT_BLUE = 'FFE6EEF8';
    const COLOR_BORDER_GRAY = 'FFD3D3D3';
    
    const fontTitle = { name: FONT_FAMILY, size: 16, bold: true, color: { argb: COLOR_TITLE_DARK_BLUE } };
    const fontSection = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: COLOR_TITLE_DARK_BLUE } };
    const fontHeader = { name: FONT_FAMILY, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontData = { name: FONT_FAMILY, size: 10 };
    const fontDataBold = { name: FONT_FAMILY, size: 10, bold: true };
    const fontDataItalic = { name: FONT_FAMILY, size: 10, italic: true };
    
    const borderThin = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_GRAY } },
        left: { style: 'thin', color: { argb: COLOR_BORDER_GRAY } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_GRAY } },
        right: { style: 'thin', color: { argb: COLOR_BORDER_GRAY } }
    };
    
    const fillHeader = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_HEADER_NAVY }
    };
    
    const fillSection = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_SECTION_LIGHT_BLUE }
    };
    
    const alignCenter = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const alignLeft = { vertical: 'middle', horizontal: 'left', wrapText: true };
    
    // Helper function to apply styling to a cell range
    function applyStylesToRange(worksheet, startRow, startCol, endRow, endCol, styles) {
        for (let r = startRow; r <= endRow; r++) {
            const row = worksheet.getRow(r);
            for (let c = startCol; c <= endCol; c++) {
                const cell = row.getCell(c);
                if (styles.font) cell.font = styles.font;
                if (styles.fill) cell.fill = styles.fill;
                if (styles.border) cell.border = styles.border;
                if (styles.alignment) cell.alignment = styles.alignment;
            }
        }
    }
    
    // ==========================================
    // SHEET 1: 1. Tổng quan & Kiến trúc
    // ==========================================
    const sheet1Name = '1. Tổng quan & Kiến trúc';
    const ws1 = workbook.addWorksheet(sheet1Name, {
        views: [{ showGridLines: true }]
    });
    
    ws1.columns = [
        { key: 'colA', width: 28 },
        { key: 'colB', width: 48 },
        { key: 'colC', width: 48 }
    ];
    
    // Title Row
    ws1.mergeCells('A1:C1');
    const titleCell1 = ws1.getCell('A1');
    titleCell1.value = 'TÀI LIỆU BÀN GIAO KỸ THUẬT - HỆ THỐNG CHECKER NỘI BỘ (CROSSCHECK & LAB)';
    ws1.getRow(1).height = 40;
    applyStylesToRange(ws1, 1, 1, 1, 3, {
        font: fontTitle,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Empty row 2
    ws1.getRow(2).height = 15;
    
    // Section 1: Tổng quan
    ws1.mergeCells('A3:C3');
    ws1.getCell('A3').value = '1. TỔNG QUAN & KIẾN TRÚC HỆ THỐNG';
    ws1.getRow(3).height = 26;
    applyStylesToRange(ws1, 3, 1, 3, 3, {
        font: fontSection,
        fill: fillSection,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Header for Table 1
    const t1Header = ws1.addRow(['Hạng mục', 'Nội dung chi tiết', 'Ghi chú / Mô tả']);
    t1Header.height = 25;
    applyStylesToRange(ws1, t1Header.number, 1, t1Header.number, 3, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const overviewData = [
        ['Tên phân hệ', 'Hệ thống Checker Nội Bộ (Internal Checker Dashboard)', 'Áp dụng cho trang https://insole-tracking-data.vercel.app/internal-checker.html'],
        ['Mục tiêu hệ thống', 'Kiểm tra chéo (Crosscheck) mẫu đầu chuyền và ghi nhận kết quả kiểm định Test Lab tại Ortholite Việt Nam. Cho phép tổ kiểm tra chụp ảnh thực tế mẫu sản phẩm, đối chiếu PO và đồng bộ trạng thái lên hệ thống.', 'Giúp kiểm soát chất lượng đầu ra sản phẩm, phát hiện sai sót sớm'],
        ['Kiến trúc ứng dụng', 'Kiến trúc Serverless / Client-Direct. Mã nguồn chạy hoàn toàn dưới Client giao tiếp thông qua thư viện Supabase JS SDK để đọc/ghi trực tiếp vào cơ sở dữ liệu.', 'Giảm độ trễ hệ thống, tối giản hóa việc duy trì server'],
        ['Hệ thống lưu trữ ảnh', 'Sử dụng Supabase Storage với Bucket công khai tên "photos". Ảnh chụp từ Camera của công nhân được tải lên và sinh mã URL liên kết.', 'Ảnh mẫu được phân tách theo thư mục phân hệ trên Bucket'],
        ['Công nghệ Frontend', 'HTML5, CSS3, Tailwind CSS (CDN), Google Fonts (Inter, Outfit), Javascript (ES6), Html5-Qrcode (quét mã vạch bằng camera), Web Audio API (phát tiếng beep cảnh báo).', 'Tối ưu hóa khả năng hiển thị responsive trên thiết bị quét PDA'],
        ['Cơ sở dữ liệu (DBMS)', 'Supabase (PostgreSQL) - Lưu trữ bảng dữ liệu kiểm định chéo và kết quả Test Lab, bảo mật thông qua Row Level Security (RLS).', 'Lưu vết lịch sử kiểm định đồng bộ theo thời gian thực']
    ];
    
    overviewData.forEach(data => {
        const row = ws1.addRow(data);
        row.height = 24;
        applyStylesToRange(ws1, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws1, row.number, 2, row.number, 3, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });
    
    // Empty row
    const emptyRow1 = ws1.addRow([]);
    emptyRow1.height = 15;
    
    // Section 2: Danh sách file mã nguồn chính
    const s2RowNumber = emptyRow1.number + 1;
    ws1.mergeCells(`A${s2RowNumber}:C${s2RowNumber}`);
    ws1.getCell(`A${s2RowNumber}`).value = '2. DANH SÁCH CÁC FILE MÃ NGUỒN CHÍNH';
    ws1.getRow(s2RowNumber).height = 26;
    applyStylesToRange(ws1, s2RowNumber, 1, s2RowNumber, 3, {
        font: fontSection,
        fill: fillSection,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    const t2Header = ws1.addRow(['Tên File (Prepended STT)', 'Đường dẫn (Path trong Project)', 'Vai trò & Chức năng chi tiết']);
    t2Header.height = 25;
    applyStylesToRange(ws1, t2Header.number, 1, t2Header.number, 3, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const filesData = [
        ['1. internal-checker.html', '/public/internal-checker.html', 'Trang giao diện duy nhất chứa toàn bộ cấu trúc HTML, styling CSS và logic Javascript của hệ thống Checker nội bộ (bao gồm đăng nhập MSNV, quét mã RPRO, chụp ảnh và lưu trữ lịch sử).'],
        ['2. setup_internal_checker.sql', '/setup_internal_checker.sql', 'Script SQL khởi tạo hai bảng dữ liệu chính crosscheck_sample và test_lab, phân quyền Row Level Security (RLS) cho phép truy cập ẩn danh.'],
        ['3. update_internal_checker_photos.sql', '/update_internal_checker_photos.sql', 'Script SQL bổ sung cột image_url để lưu trữ ảnh chụp mẫu và khởi tạo cấu hình Storage Bucket "photos" công khai trên Supabase.'],
        ['4. update_note_internal_checker.sql', '/update_note_internal_checker.sql', 'Script SQL bổ sung cột note (ghi chú khi xác nhận mẫu) cho cả hai bảng dữ liệu kiểm định.']
    ];
    
    filesData.forEach(data => {
        const row = ws1.addRow(data);
        row.height = 24;
        applyStylesToRange(ws1, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws1, row.number, 2, row.number, 2, {
            font: fontDataItalic,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws1, row.number, 3, row.number, 3, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });

    // ==========================================
    // SHEET 2: 2. Cơ sở dữ liệu
    // ==========================================
    const sheet2Name = '2. Cơ sở dữ liệu';
    const ws2 = workbook.addWorksheet(sheet2Name, {
        views: [{ showGridLines: true }]
    });
    
    ws2.columns = [
        { key: 'colA', width: 22 },
        { key: 'colB', width: 18 },
        { key: 'colC', width: 28 },
        { key: 'colD', width: 42 },
        { key: 'colE', width: 42 }
    ];
    
    // Title Row
    ws2.mergeCells('A1:E1');
    const titleCell2 = ws2.getCell('A1');
    titleCell2.value = 'CẤU TRÚC CHI TIẾT CƠ SỞ DỮ LIỆU (DATABASE SCHEMA) - INTERNAL CHECKER';
    ws2.getRow(1).height = 40;
    applyStylesToRange(ws2, 1, 1, 1, 5, {
        font: fontTitle,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Empty row 2
    ws2.getRow(2).height = 15;
    
    // Section 1: crosscheck_sample
    ws2.mergeCells('A3:E3');
    ws2.getCell('A3').value = '1. BẢNG KIỂM TRA CHÉO ĐẦU CHUYỀN: crosscheck_sample';
    ws2.getRow(3).height = 26;
    applyStylesToRange(ws2, 3, 1, 3, 5, {
        font: fontSection,
        fill: fillSection,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Header for Table 1
    const t2_1Header = ws2.addRow(['Tên Cột (Column Name)', 'Kiểu Dữ Liệu', 'Ràng Buộc (Constraints)', 'Mô Tả Nghiệp Vụ', 'Ý Nghĩa Thực Tế / Ví dụ']);
    t2_1Header.height = 25;
    applyStylesToRange(ws2, t2_1Header.number, 1, t2_1Header.number, 5, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const dbSampleData = [
        ['id', 'BIGINT', 'GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY', 'Mã định danh duy nhất của bản ghi.', 'Khóa chính tự tăng.'],
        ['msnv', 'TEXT', 'Nullable', 'Mã số nhân viên thực hiện kiểm định chéo.', 'Ví dụ: NV1234.'],
        ['rpro', 'TEXT', 'Nullable', 'Mã RPRO của mẫu sản phẩm.', 'Định danh duy nhất loại đế sản xuất để đối chiếu dữ liệu gốc.'],
        ['customer', 'TEXT', 'Nullable', 'Tên khách hàng đặt đơn.', 'Ví dụ: Ortholite.'],
        ['brand', 'TEXT', 'Nullable', 'Mã thương hiệu sản phẩm.', 'Ví dụ: NKE, ADD, PUM...'],
        ['mold', 'TEXT', 'Nullable', 'Mã khuôn đế.', 'Xác định khuôn đúc chi tiết.'],
        ['po_qty', 'NUMERIC', 'Nullable', 'Số lượng đặt hàng theo PO.', 'Lấy dữ liệu gốc điền vào hoặc người kiểm tra nhập thủ công.'],
        ['image_url', 'TEXT', 'Nullable', 'Địa chỉ ảnh chụp mẫu thực tế trên Supabase Storage.', 'Liên kết trực tiếp tới tệp ảnh công khai trong bucket "photos".'],
        ['note', 'TEXT', 'Nullable', 'Ghi chú thêm khi xác nhận mẫu sản phẩm.', 'Công nhân ghi chú lỗi hoặc các điểm cần lưu ý.'],
        ['created_at', 'TIMESTAMPTZ', 'DEFAULT timezone(\'utc\'::text, now()) NOT NULL', 'Thời điểm bản ghi được ghi nhận.', 'Hệ thống tự động lưu ngày giờ kiểm định chéo.']
    ];
    
    dbSampleData.forEach(data => {
        const row = ws2.addRow(data);
        row.height = 24;
        applyStylesToRange(ws2, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws2, row.number, 2, row.number, 3, {
            font: fontDataItalic,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws2, row.number, 4, row.number, 5, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });
    
    // Empty row
    const emptyRow2 = ws2.addRow([]);
    emptyRow2.height = 15;
    
    // Section 2: test_lab
    const s2DbRowNumber = emptyRow2.number + 1;
    ws2.mergeCells(`A${s2DbRowNumber}:E${s2DbRowNumber}`);
    ws2.getCell(`A${s2DbRowNumber}`).value = '2. BẢNG KIỂM ĐỊNH PHÒNG LAB: test_lab';
    ws2.getRow(s2DbRowNumber).height = 26;
    applyStylesToRange(ws2, s2DbRowNumber, 1, s2DbRowNumber, 5, {
        font: fontSection,
        fill: fillSection,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    const t2_2Header = ws2.addRow(['Tên Cột (Column Name)', 'Kiểu Dữ Liệu', 'Ràng Buộc (Constraints)', 'Mô Tả Nghiệp Vụ', 'Ý Nghĩa Thực Tế / Ví dụ']);
    t2_2Header.height = 25;
    applyStylesToRange(ws2, t2_2Header.number, 1, t2_2Header.number, 5, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const dbLabData = [
        ['id', 'BIGINT', 'GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY', 'Mã định danh duy nhất của bản ghi kết quả Lab.', 'Khóa chính tự tăng.'],
        ['msnv', 'TEXT', 'Nullable', 'Mã số nhân viên của kỹ thuật viên phòng Lab.', 'Ví dụ: NV5678.'],
        ['rpro', 'TEXT', 'Nullable', 'Mã RPRO của mẫu kiểm định Lab.', 'Đối chiếu với dữ liệu master để điền thông tin.'],
        ['customer', 'TEXT', 'Nullable', 'Tên khách hàng đặt đơn.', 'Tên khách hàng đối tác.'],
        ['brand', 'TEXT', 'Nullable', 'Mã thương hiệu sản phẩm.', 'Đơn vị thương hiệu đặt hàng.'],
        ['mold', 'TEXT', 'Nullable', 'Mã khuôn mẫu của Lab.', 'Xác định loại khuôn đế.'],
        ['po_qty', 'NUMERIC', 'Nullable', 'Số lượng PO tương ứng đơn hàng.', 'Hỗ trợ đối chiếu số lượng sản xuất.'],
        ['image_url', 'TEXT', 'Nullable', 'Địa chỉ ảnh chụp mẫu thực tế tại phòng Lab.', 'Tải lên bucket "photos", lưu giữ để làm minh chứng kiểm định.'],
        ['note', 'TEXT', 'Nullable', 'Ghi chú đính kèm kết quả đo đạc Lab.', 'Ghi nhận thông số kỹ thuật đặc biệt hoặc lỗi ngoại quan.'],
        ['created_at', 'TIMESTAMPTZ', 'DEFAULT timezone(\'utc\'::text, now()) NOT NULL', 'Thời điểm ghi nhận kết quả đo đạc Lab.', 'Hệ thống tự động lưu ngày giờ hệ thống.']
    ];
    
    dbLabData.forEach(data => {
        const row = ws2.addRow(data);
        row.height = 24;
        applyStylesToRange(ws2, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws2, row.number, 2, row.number, 3, {
            font: fontDataItalic,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws2, row.number, 4, row.number, 5, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });

    // ==========================================
    // SHEET 3: 3. Chi tiết Chức năng
    // ==========================================
    const sheet3Name = '3. Chi tiết Chức năng';
    const ws3 = workbook.addWorksheet(sheet3Name, {
        views: [{ showGridLines: true }]
    });
    
    ws3.columns = [
        { key: 'colA', width: 22 },
        { key: 'colB', width: 25 },
        { key: 'colC', width: 50 },
        { key: 'colD', width: 50 }
    ];
    
    // Title Row
    ws3.mergeCells('A1:D1');
    const titleCell3 = ws3.getCell('A1');
    titleCell3.value = 'MÔ TẢ CHI TIẾT CÁC CHỨC NĂNG HỆ THỐNG CHECKER NỘI BỘ';
    ws3.getRow(1).height = 40;
    applyStylesToRange(ws3, 1, 1, 1, 4, {
        font: fontTitle,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Empty row 2
    ws3.getRow(2).height = 15;
    
    // Header for Table
    const t3Header = ws3.addRow(['Màn Hình / Bộ Phận', 'Tên Chức Năng', 'Cách Thức Hoạt Động (Flow)', 'Lưu Ý Kỹ Thuật Cho IT / Vận Hành']);
    t3Header.height = 25;
    applyStylesToRange(ws3, t3Header.number, 1, t3Header.number, 4, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const functionsData = [
        [
            'Màn hình Đăng nhập MSNV (Overlay)',
            'Xác thực MSNV trước khi truy cập',
            'Khi mở trang, một popup chặn toàn bộ màn hình sẽ xuất hiện yêu cầu nhân viên nhập Mã Số Nhân Viên (MSNV). Nhân viên nhập mã (ví dụ: NV1234) và nhấn "Xác nhận truy cập". Hệ thống lưu trữ MSNV vào localStorage và ẩn popup.',
            'Nếu trong localStorage đã lưu sẵn MSNV hợp lệ từ phiên trước, hệ thống sẽ bỏ qua màn hình đăng nhập này để rút ngắn thao tác cho người dùng. IT có thể xem thông tin này lưu ở Client qua Application Tab của Trình duyệt.'
        ],
        [
            'Header & Thanh chuyển đổi (Tab Navigation)',
            'Chuyển phân hệ & Thoát đăng nhập',
            'Thanh Tab cho phép chuyển đổi qua lại giữa 2 phân hệ: "📋 Crosscheck mẫu đầu chuyền" (tab-crosscheck) và "🔬 Test lab" (tab-test-lab). Header hiển thị mã MSNV hiện tại kèm nút "Đổi MSNV" để đăng xuất / đổi tài khoản.',
            'Khi click chuyển Tab, hàm switchTab() được kích hoạt để thay đổi giao diện, thay đổi bảng dữ liệu đích (crosscheck_sample hoặc test_lab) và tải lại bảng lịch sử giao dịch tương ứng.'
        ],
        [
            'Màn hình quét mã & Nhập liệu (Trái)',
            'Quét mã QR / Nhập tay RPRO',
            'Hệ thống tích hợp camera quét mã QR của sản phẩm dán trên tem. Người dùng cũng có thể nhập tay RPRO. Khi có mã RPRO, hệ thống tự động tìm kiếm thông tin đơn hàng tương ứng trên bảng powerapp và Masterdata để điền thông tin Khách hàng, Thương hiệu, Mã khuôn và Số lượng PO.',
            'Hỗ trợ quét đồng thời nhiều mã RPRO phân tách nhau bởi dấu phẩy hoặc ký tự đặc biệt. Quá trình tra cứu song song (Promise.all) được tối ưu hóa giúp autofill nhanh các trường nhập thông tin đơn hàng.'
        ],
        [
            'Màn hình quét mã & Nhập liệu (Trái)',
            'Chụp ảnh mẫu sản phẩm thực tế',
            'Nút "Chụp Ảnh Lưu Mẫu" kích hoạt camera của điện thoại/máy tính bảng ở chế độ chụp thực địa (capture="environment"). Sau khi chụp thành công, hệ thống hiển thị ảnh preview kèm nút Xóa để chụp lại. Đây là trường thông tin bắt buộc để làm bằng chứng kiểm định chéo.',
            'Sử dụng thẻ input loại file với thuộc tính accept="image/*" và capture. IT cần hướng dẫn người dùng sử dụng trình duyệt chuẩn như Chrome/Safari trên di động để kích hoạt đúng giao diện camera của hệ điều hành.'
        ],
        [
            'Màn hình Thông tin đơn hàng (Phải)',
            'Xác nhận & Lưu bản ghi kiểm định',
            'Kỹ thuật viên đối chiếu thông tin điền tự động, bổ sung ghi chú vào trường Note rồi bấm "Xác Nhận & Lưu Bản Ghi". Hệ thống tiến hành chuyển ảnh chụp thành Blob, tải lên Supabase Storage bucket "photos" theo đường dẫn phân mục, lấy Public URL ảnh, rồi INSERT toàn bộ bản ghi dữ liệu vào PostgreSQL.',
            'Khi lưu thành công, hệ thống phát âm thanh "bíp" thành công (success beep), tự động xóa sạch các ô nhập thông tin đơn hàng, ảnh chụp, và tự động gọi .focus() trở lại trường nhập RPRO để tiếp tục lượt tiếp theo.'
        ],
        [
            'Nhật ký lịch sử kiểm định (Dưới)',
            'Xem & Tìm kiếm nhật ký kiểm định',
            'Hiển thị danh sách các bản ghi đã kiểm định gần nhất dưới dạng bảng phân trang (phân tách 2 phân hệ theo tab). Hỗ trợ lọc lịch sử theo khoảng thời gian (Từ ngày - Đến ngày), ô tìm kiếm nhanh và nút "Xuất báo cáo Excel". Cột "Ảnh mẫu" chứa liên kết click để xem ảnh chụp phóng to.',
            'Sử dụng thư viện xlsx (SheetJS) ở Client để xuất trực tiếp danh sách lịch sử đang lọc ra file Excel. Bảng lịch sử được phân trang cục bộ (Local Pagination) để tối ưu hiệu năng hiển thị khi danh sách quá dài.'
        ]
    ];
    
    functionsData.forEach(data => {
        const row = ws3.addRow(data);
        row.height = 24;
        applyStylesToRange(ws3, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws3, row.number, 2, row.number, 2, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws3, row.number, 3, row.number, 4, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });

    // ==========================================
    // SHEET 4: 4. Yêu cầu & Vai trò
    // ==========================================
    const sheet4Name = '4. Yêu cầu & Vai trò';
    const ws4 = workbook.addWorksheet(sheet4Name, {
        views: [{ showGridLines: true }]
    });
    
    ws4.columns = [
        { key: 'colA', width: 22 },
        { key: 'colB', width: 25 },
        { key: 'colC', width: 50 },
        { key: 'colD', width: 50 }
    ];
    
    // Title Row
    ws4.mergeCells('A1:D1');
    const titleCell4 = ws4.getCell('A1');
    titleCell4.value = 'BẢNG PHÂN QUYỀN VAI TRÒ & CÁC YÊU CẦU PHI CHỨC NĂNG - INTERNAL CHECKER';
    ws4.getRow(1).height = 40;
    applyStylesToRange(ws4, 1, 1, 1, 4, {
        font: fontTitle,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Empty row 2
    ws4.getRow(2).height = 15;
    
    // Section 1: Phân quyền & vai trò
    ws4.mergeCells('A3:D3');
    ws4.getCell('A3').value = '1. PHÂN QUYỀN & VAI TRÒ NGƯỜI DÙNG';
    ws4.getRow(3).height = 26;
    applyStylesToRange(ws4, 3, 1, 3, 4, {
        font: fontSection,
        fill: fillSection,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Header for Table 1
    const t4_1Header = ws4.addRow(['Nhóm Người Dùng / Vai Trò', 'Tên Vai Trò / Quyền Hạn', 'Mô Tả Nghiệp Vụ', 'Giải Pháp Kỹ Thuật / Ghi Chú']);
    t4_1Header.height = 25;
    applyStylesToRange(ws4, t4_1Header.number, 1, t4_1Header.number, 4, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const rolesData = [
        [
            'Nhân viên kiểm tra chéo (Crosschecker)',
            'Kiểm tra mẫu đầu chuyền',
            'Kiểm tra chất lượng mẫu đế tại xưởng sản xuất, quét mã QR RPRO, chụp ảnh đối chiếu trực tiếp trước khi bắt đầu chạy chuyền loạt.',
            'Thực hiện trên thiết bị PDA cầm tay hoặc điện thoại di động thông qua phân hệ tab "Crosscheck". Toàn bộ thao tác đều được ghi lại dưới mã MSNV của nhân viên đó.'
        ],
        [
            'Kỹ thuật viên phòng Lab (Lab Tester)',
            'Thử nghiệm & Ghi nhận thông số Lab',
            'Đo đạc chất lượng, ghi nhận mẫu kiểm nghiệm phòng Lab, chụp ảnh lưu giữ chứng cứ kiểm nghiệm vật lý/hóa học.',
            'Thao tác trên máy tính bảng hoặc máy tính để bàn phòng thí nghiệm thông qua phân hệ tab "Test lab". Lưu trữ dữ liệu độc lập với dữ liệu kiểm định xưởng.'
        ],
        [
            'Quản lý sản xuất / Giám sát IT',
            'Giám sát & Kết xuất báo cáo',
            'Xem toàn bộ lịch sử kiểm tra chéo và test lab, lọc các bản ghi theo ngày, theo nhân viên hoặc tìm kiếm lỗi ngoại quan để tải file Excel phục vụ báo cáo chất lượng.',
            'Truy cập trực tiếp bảng lịch sử bên dưới giao diện, sử dụng các bộ lọc nâng cao và tải file Excel được kết xuất trực tiếp tại Client.'
        ]
    ];
    
    rolesData.forEach(data => {
        const row = ws4.addRow(data);
        row.height = 24;
        applyStylesToRange(ws4, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws4, row.number, 2, row.number, 2, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws4, row.number, 3, row.number, 4, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });
    
    // Empty row
    const emptyRow4 = ws4.addRow([]);
    emptyRow4.height = 15;
    
    // Section 2: Yêu cầu phi chức năng
    const s2ReqRowNumber = emptyRow4.number + 1;
    ws4.mergeCells(`A${s2ReqRowNumber}:D${s2ReqRowNumber}`);
    ws4.getCell(`A${s2ReqRowNumber}`).value = '2. YÊU CẦU PHI CHỨC NĂNG QUAN TRỌNG';
    ws4.getRow(s2ReqRowNumber).height = 26;
    applyStylesToRange(ws4, s2ReqRowNumber, 1, s2ReqRowNumber, 4, {
        font: fontSection,
        fill: fillSection,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Header for Table 2
    const t4_2Header = ws4.addRow(['Nhóm Yêu Cầu', 'Tên Yêu Cầu Chi Tiết', 'Mô Tả Nghiệp Vụ', 'Giải Pháp Kỹ Thuật / Ghi Chú']);
    t4_2Header.height = 25;
    applyStylesToRange(ws4, t4_2Header.number, 1, t4_2Header.number, 4, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const requirementsData = [
        [
            'Tự động Focus (Auto-focus)',
            'Tối ưu hóa tốc độ quét mã',
            'Sau khi nhấn Lưu thành công hoặc khi xảy ra lỗi quét, tiêu điểm của con trỏ chuột phải tự động quay trở lại ô nhập liệu RPRO để công nhân quét đợt tiếp theo ngay lập tức.',
            'Sử dụng JavaScript: document.getElementById(\'input-rpro\').focus(); sau khi kết thúc chu trình API lưu trữ hoặc khi bắt đầu quét mới.'
        ],
        [
            'Phản hồi âm thanh (Beep Sound)',
            'Phát âm thanh bíp bíp cảnh báo',
            'Hệ thống phải phát âm bíp khi lưu trữ dữ liệu hoặc quét mã QR: âm cao ngắn khi thành công, âm trầm kéo dài khi thất bại để công nhân không cần nhìn màn hình.',
            'Tích hợp Web Audio API (sử dụng OscillatorNode) sinh tần số âm trực tiếp trên trình duyệt, không dùng file âm thanh tĩnh .mp3 để tránh bị hệ điều hành chặn phát tự động.'
        ],
        [
            'Quyền Camera & Bảo mật',
            'Sử dụng Camera trực tiếp',
            'Hệ thống yêu cầu quyền truy cập Camera của người dùng để thực hiện quét QR và chụp ảnh mẫu tại xưởng.',
            'Do cơ chế bảo mật của trình duyệt di động, camera chỉ được phép kích hoạt khi trang web chạy dưới giao thức mã hóa HTTPS. IT cần triển khai chứng chỉ SSL trên máy chủ hosting.'
        ],
        [
            'Tối ưu băng thông & Dung lượng',
            'Kiểm soát dung lượng ảnh tải lên',
            'Hình ảnh mẫu chụp từ camera điện thoại có độ phân giải rất cao (thường từ 3MB - 10MB), cần được kiểm soát để tránh đầy bộ nhớ và làm chậm quá trình tải lên.',
            'IT nên cấu hình nén ảnh (Image compression) trước khi đẩy lên Supabase Storage hoặc giảm độ phân giải trực tiếp thông qua thuộc tính capture/canvas để dung lượng mỗi ảnh < 500KB.'
        ],
        [
            'Giao diện di động (Mobile Responsive)',
            'Khả năng co giãn trên thiết bị cầm tay',
            'Giao diện nhập liệu được thiết kế dạng cột đứng co giãn linh hoạt, các nút nhấn lớn dễ thao tác bằng ngón tay trong môi trường nhà xưởng.',
            'Sử dụng các lớp responsive của Tailwind CSS. Khung hiển thị camera chiếm tỷ lệ lớn ở cột trái giúp công nhân dễ căn chỉnh tem QR khi quét.'
        ]
    ];
    
    requirementsData.forEach(data => {
        const row = ws4.addRow(data);
        row.height = 24;
        applyStylesToRange(ws4, row.number, 1, row.number, 1, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws4, row.number, 2, row.number, 2, {
            font: fontDataBold,
            border: borderThin,
            alignment: alignLeft
        });
        applyStylesToRange(ws4, row.number, 3, row.number, 4, {
            font: fontData,
            border: borderThin,
            alignment: alignLeft
        });
    });
    
    // Save Workbook
    const outputPath = path.join(__dirname, '[Checker noi bo].xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Excel file successfully written to: ${outputPath}`);
}

generateExcel().catch(err => {
    console.error('Error generating Excel:', err);
});
