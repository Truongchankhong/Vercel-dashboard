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
    titleCell1.value = 'TÀI LIỆU BÀN GIAO KỸ THUẬT - DỰ ÁN QUẢN LÝ HÀNG DƯ (SURPLUS)';
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
        ['Tên dự án', 'Hệ thống Quản lý Hàng Dư (Surplus Management)', 'Áp dụng cho trang https://insole-tracking-data.vercel.app/surplus-landing.html'],
        ['Mục tiêu hệ thống', 'Theo dõi, nhập liệu và kiểm soát lượng hàng dư thừa (surplus goods) phát sinh sau các ca sản xuất tại các phân hệ (LPS, Molding, Leanline Molded và Leanline DC) nhằm tối ưu hóa tồn kho và tái sử dụng vật tư.', 'Tránh lãng phí vật tư sản xuất, giảm chi phí nguyên vật liệu'],
        ['Kiến trúc ứng dụng', 'Mô hình Client-Direct (Serverless). Giao diện chạy trực tiếp ở Client kết nối thẳng tới cơ sở dữ liệu Supabase thông qua Supabase Javascript SDK.', 'Không sử dụng backend trung gian để tối giản kiến trúc và tăng tốc phản hồi'],
        ['Công nghệ Frontend', 'HTML5, CSS3, Tailwind CSS (CDN), Javascript (ES6 Module), Html5-Qrcode (quét mã vạch bằng camera), Driver.js (hướng dẫn sử dụng trực quan).', 'Giao diện hiện đại, responsive tốt trên các dòng điện thoại di động và thiết bị PDA chuyên dụng'],
        ['Cơ sở dữ liệu (DBMS)', 'Supabase (PostgreSQL) - Hỗ trợ Row Level Security (RLS) bảo mật dữ liệu và cơ chế đồng bộ dữ liệu Realtime.', 'Đảm bảo cập nhật tức thời số lượng tồn kho và lịch sử xuất/nhập'],
        ['Tích hợp dữ liệu', 'Hệ thống tự động tra cứu (autofill) thông tin mô tả chi tiết của PU, Fabric từ bảng dữ liệu gốc (Masterdata, powerapp) khi người dùng nhập hoặc quét mã RPRO.', 'Giảm thiểu tối đa thao tác nhập tay của công nhân, giảm thiểu lỗi nhập liệu']
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
        ['1. surplus-landing.html', '/public/surplus-landing.html', 'Trang cổng thông tin (Landing Page) điều hướng người dùng chọn bộ phận làm việc (LPS, Molding, Leanline Molded, Leanline DC) hoặc xem Dashboard tổng hợp hàng dư.'],
        ['2. surplus-goods.html', '/public/surplus-goods.html', 'Trang giao diện nhập liệu hàng dư chính, hỗ trợ tìm kiếm sản phẩm, quét mã vạch bằng camera, và lưới nhập số lượng theo kích cỡ size.'],
        ['3. surplus-goods.js', '/public/surplus-goods.js', 'Logic xử lý của trang nhập liệu: tra cứu thông tin sản phẩm từ Masterdata/Powerapp, hiển thị lưới size, xử lý lưu đè/cộng dồn và ghi nhận lịch sử giao dịch.'],
        ['4. surplus-stats.html', '/public/surplus-stats.html', 'Trang giao diện hiển thị danh sách lịch sử giao dịch nhập/xuất và tồn kho hàng dư chi tiết theo bộ phận.'],
        ['5. surplus-stats.js', '/public/surplus-stats.js', 'Logic tải dữ liệu lịch sử từ bảng surplusgoods_history, hỗ trợ lọc theo ngày, theo bộ phận và kết xuất file Excel báo cáo giao dịch.'],
        ['6. surplus-dashboard.html', '/public/surplus-dashboard.html', 'Giao diện Dashboard tổng hợp tồn kho hàng dư của tất cả các bộ phận tại xưởng sản xuất, hỗ trợ tải file Excel báo cáo tồn kho hiện tại.'],
        ['7. surplus_goods_schema.sql', '/surplus_goods_schema.sql', 'Script SQL định nghĩa cấu trúc bảng chính surplusgoods lưu trữ số lượng tồn kho theo từng size từ 3 đến 15.'],
        ['8. setup_surplus_history.sql', '/setup_surplus_history.sql', 'Script SQL định nghĩa cấu trúc bảng lịch sử surplusgoods_history lưu trữ vết các lần điều chỉnh số lượng (nhập/xuất).']
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
    titleCell2.value = 'THÔNG TIN CẤU TRÚC CƠ SỞ DỮ LIỆU (DATABASE SCHEMA) - SUPABASE';
    ws2.getRow(1).height = 40;
    applyStylesToRange(ws2, 1, 1, 1, 5, {
        font: fontTitle,
        alignment: { vertical: 'middle', horizontal: 'left' }
    });
    
    // Empty row 2
    ws2.getRow(2).height = 15;
    
    // Section 1: surplusgoods
    ws2.mergeCells('A3:E3');
    ws2.getCell('A3').value = '1. BẢNG TỒN KHO HIỆN TẠI: surplusgoods';
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
    
    const dbMainData = [
        ['id', 'UUID', 'PRIMARY KEY DEFAULT uuid_generate_v4()', 'Mã định danh duy nhất của bản ghi hàng dư.', 'Khóa chính tự sinh, định danh riêng biệt từng dòng dữ liệu.'],
        ['created_at', 'TIMESTAMPTZ', 'DEFAULT now()', 'Thời điểm tạo bản ghi tồn kho.', 'Ngày giờ hệ thống tự động ghi nhận khi có mã mới.'],
        ['rpro', 'TEXT', 'NOT NULL', 'Mã RPRO của sản phẩm.', 'Định danh duy nhất loại đế sản xuất để làm cơ sở đối chiếu.'],
        ['so', 'TEXT', 'Nullable', 'Số Sales Order (đơn đặt hàng).', 'Liên kết với đơn hàng cụ thể (Đặc thù bắt buộc của Molding).'],
        ['brand_code', 'TEXT', 'Nullable', 'Mã thương hiệu khách hàng.', 'Ví dụ: NKE (Nike), ADD (Adidas), PUM (Puma)...'],
        ['mold', 'TEXT', 'Nullable', 'Mã khuôn đế.', 'Xác định loại khuôn đúc tương ứng.'],
        ['bom', 'TEXT', 'Nullable', 'Mã cấu trúc vật liệu (Bill of Materials).', 'Mã vật tư để tra cứu thành phần cấu tạo.'],
        ['pu', 'TEXT', 'Nullable', 'Mô tả chất liệu PU.', 'Mô tả chi tiết chất liệu hoặc tên thành phần PU.'],
        ['fabric', 'TEXT', 'Nullable', 'Mô tả loại vải dán mặt đế.', 'Loại vải bọc trên bề mặt của đế.'],
        ['section', 'TEXT', 'Nullable', 'Bộ phận sản xuất phát sinh hàng dư.', 'Nhận giá trị phân hệ: LPS, MOLDING, LEANLINE_MOLDED, LEANLINE_DC.'],
        ['note', 'TEXT', 'Nullable', 'Ghi chú tự do từ người nhập liệu.', 'Thông tin lưu ý thêm từ tổ trưởng hoặc thủ kho.'],
        ['size_3 đến size_15', 'FLOAT8', 'DEFAULT 0', 'Số lượng của các size chuẩn từ 3.0 đến 15.0.', 'Gồm 25 cột size cách nhau 0.5 (size_3, size_3_5, size_4, ..., size_15) để lưu số lượng tồn thực tế.'],
        ['dynamic_sizes', 'JSONB', 'DEFAULT \'{}\'::jsonb', 'Lưu trữ động các size đặc biệt ngoài size chuẩn.', 'Lưu các size lẻ hoặc size trẻ em dưới dạng Key-Value (ví dụ: {"2K": 10, "14C": 5}).']
    ];
    
    dbMainData.forEach(data => {
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
    
    // Section 2: surplusgoods_history
    const s2DbRowNumber = emptyRow2.number + 1;
    ws2.mergeCells(`A${s2DbRowNumber}:E${s2DbRowNumber}`);
    ws2.getCell(`A${s2DbRowNumber}`).value = '2. BẢNG LỊCH SỬ GIAO DỊCH: surplusgoods_history';
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
    
    const dbHistoryData = [
        ['id', 'UUID', 'PRIMARY KEY DEFAULT uuid_generate_v4()', 'Mã định danh duy nhất của dòng lịch sử.', 'Khóa chính tự sinh cho mỗi giao dịch nhập/xuất.'],
        ['surplus_id', 'UUID', 'Nullable', 'ID liên kết tới bảng surplusgoods.', 'Khóa ngoại để liên kết dòng lịch sử với bản ghi tồn kho hiện hành.'],
        ['rpro', 'TEXT', 'Nullable', 'Mã RPRO sản phẩm tại thời điểm giao dịch.', 'Dùng để đối chiếu và tìm kiếm nhanh lịch sử mà không cần join bảng.'],
        ['section', 'TEXT', 'Nullable', 'Bộ phận thực hiện giao dịch.', 'Phân biệt lịch sử giao dịch của LPS, Molding, Leanline Molded hoặc Leanline DC.'],
        ['old_total', 'FLOAT8', 'DEFAULT 0', 'Tổng số lượng tồn kho cũ trước khi thay đổi.', 'Tổng số lượng tồn kho của toàn bộ các size trước thời điểm giao dịch.'],
        ['new_total', 'FLOAT8', 'DEFAULT 0', 'Tổng số lượng tồn kho mới sau khi thay đổi.', 'Tồn kho thực tế sau khi giao dịch hoàn tất.'],
        ['change_amount', 'FLOAT8', 'DEFAULT 0', 'Số lượng thay đổi trong giao dịch.', 'Giá trị chênh lệch. Số dương (+) đại diện cho nhập, số âm (-) đại diện cho xuất.'],
        ['action_type', 'TEXT', 'Nullable', 'Loại hành động tác động.', 'Nhận giá trị: INSERT (Tạo mới), UPDATE (Thay đổi số lượng), DELETE (Xóa).'],
        ['created_at', 'TIMESTAMPTZ', 'DEFAULT now()', 'Thời điểm phát sinh giao dịch.', 'Lưu chính xác ngày giờ thực hiện thao tác để lập báo cáo theo ca/ngày.']
    ];
    
    dbHistoryData.forEach(data => {
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
    titleCell3.value = 'MÔ TẢ CHI TIẾT CÁC CHỨC NĂNG HỆ THỐNG';
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
            'Cổng thông tin (Landing Page)',
            'Điều hướng phân hệ sản xuất',
            'Hiển thị 4 nút bấm đại diện cho các bộ phận (LPS, Molding, Leanline Molded, Leanline DC) cùng nút truy cập Dashboard tổng hợp. Khi click vào nút bộ phận, hệ thống chuyển hướng sang trang nhập liệu kèm tham số tương ứng trên URL.',
            'Sử dụng query parameters ?section=... để phân biệt cấu hình. IT cần lưu ý đường dẫn này khi tạo shortcut trên màn hình thiết bị PDA của công nhân để tránh nhầm lẫn giữa các bộ phận làm việc.'
        ],
        [
            'Giao diện Nhập liệu (surplus-goods.html)',
            'Tra cứu & Tự động điền (Autofill)',
            'Công nhân nhập mã RPRO (hoặc BOM, Fabric, PU đối với LPS/Leanline) hoặc tổ hợp RPRO + SO + Brand Code (đối với Molding) vào ô tìm kiếm và bấm nút Tìm. Hệ thống tự động thực hiện truy vấn song song (Parallel) trên 2 bảng powerapp và Masterdata để lấy thông tin chi tiết về PU/Fabric và tự động điền vào giao diện.',
            'Sử dụng truy vấn .ilike() không phân biệt chữ hoa chữ thường. Nếu tìm thấy nhiều bản ghi tương tự, hiển thị danh sách gợi ý dưới ô nhập để người dùng chọn. IT cần đảm bảo các cột PRO ODER, PU, FB của bảng dữ liệu gốc được lập index để tối ưu tốc độ.'
        ],
        [
            'Giao diện Nhập liệu (surplus-goods.html)',
            'Quét mã vạch bằng Camera',
            'Công nhân nhấn nút "Quét Mã", hệ thống yêu cầu cấp quyền camera và khởi tạo trình quét mã. Sau khi hướng camera vào mã QR dán trên tem sản phẩm và quét thành công, hệ thống tự động điền mã RPRO vào ô tìm kiếm và trigger sự kiện tìm kiếm sản phẩm.',
            'Tích hợp thư viện html5-qrcode. Cần đảm bảo trang web chạy trên HTTPS để thiết bị di động cấp quyền truy cập camera. IT cần hướng dẫn công nhân căn chỉnh camera vuông góc và đủ ánh sáng để tăng tỷ lệ đọc mã chính xác.'
        ],
        [
            'Giao diện Nhập liệu (surplus-goods.html)',
            'Lưới Nhập Số Lượng theo Size',
            'Hệ thống hiển thị lưới nhập số lượng cho các size chuẩn từ 3.0 đến 15.0 (cách nhau 0.5) cùng ô nhập ghi chú. Nếu sản phẩm đã có tồn kho hàng dư trước đó, hệ thống hiển thị số lượng hiện tại bên cạnh ô nhập để người dùng tham chiếu. Khi người dùng thay đổi số lượng, tổng số lượng (Total) sẽ tự động thay đổi theo.',
            'Cho phép sử dụng phím Enter hoặc Tab để chuyển nhanh con trỏ chuột sang ô size tiếp theo, giúp tăng tốc độ nhập liệu. Sự kiện input được bind để tính toán tổng số lượng tức thời bằng Javascript trước khi lưu.'
        ],
        [
            'Giao diện Nhập liệu (surplus-goods.html)',
            'Lưu / Cập nhật dữ liệu hàng dư',
            'Người dùng nhấn nút "Lưu dữ liệu". Hệ thống kiểm tra trùng lặp trên Supabase: nếu tổ hợp khóa chính đã tồn tại, hệ thống thực hiện UPDATE (cộng dồn số lượng hoặc đè số lượng cũ tùy cấu hình). Nếu chưa tồn tại, thực hiện INSERT dòng mới. Đồng thời, tự động insert một dòng lịch sử tương ứng vào bảng surplusgoods_history.',
            'Giao dịch lưu dữ liệu được thực hiện bất đồng bộ. Sau khi lưu thành công, hệ thống sẽ phát âm thanh phản hồi bíp bíp và tự động đặt lại con trỏ (focus) vào ô nhập RPRO ban đầu để sẵn sàng cho lượt nhập tiếp theo.'
        ],
        [
            'Màn hình Thống kê (surplus-stats.html)',
            'Xem lịch sử & Xuất báo cáo',
            'Hiển thị bảng danh sách lịch sử các lần nhập/xuất hàng dư. Người dùng có thể lọc lịch sử theo khoảng thời gian (Từ ngày - Đến ngày) và theo bộ phận sản xuất. Hỗ trợ nút "Xuất báo cáo" ra file Excel trực tiếp tại trình duyệt.',
            'Dữ liệu lịch sử được lấy từ bảng surplusgoods_history, sắp xếp theo thời gian mới nhất lên đầu. Chức năng xuất Excel sử dụng thư viện xlsx (SheetJS) chạy trên trình duyệt để tạo file .xlsx tức thì mà không cần qua server.'
        ],
        [
            'Dashboard Tổng hợp (surplus-dashboard.html)',
            'Theo dõi tồn kho tổng hợp',
            'Hiển thị bảng tổng hợp toàn bộ các mặt hàng đang có số lượng hàng dư tồn kho > 0 trên toàn bộ các bộ phận. Hỗ trợ thanh tìm kiếm nhanh theo RPRO, BOM, Mold và lọc theo khoảng thời gian. Có tính năng xuất Excel tổng hợp tồn kho hiện tại.',
            'Truy vấn trực tiếp bảng chính surplusgoods lọc các dòng có tổng số lượng của các size lớn hơn 0. Hỗ trợ xuất Excel báo cáo tồn kho tổng hợp để ban giám đốc và bộ phận kho nắm thông tin điều phối sản xuất.'
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
    titleCell4.value = 'BẢNG PHÂN QUYỀN VAI TRÒ & CÁC YÊU CẦU PHI CHỨC NĂNG';
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
    const t4_1Header = ws4.addRow(['Nhóm Người Dùng / Vai Trò', 'Tên Vai Trò / Quyền Hạn', 'Mô Tả Nghiệp Vụ Hàng Dư', 'Giải Pháp Kỹ Thuật / Ghi Chú']);
    t4_1Header.height = 25;
    applyStylesToRange(ws4, t4_1Header.number, 1, t4_1Header.number, 4, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const rolesData = [
        [
            'Tổ trưởng sản xuất (LPS / Molding / Leanline)',
            'Nhập liệu hàng dư',
            'Khai báo số lượng hàng dư phát sinh sau mỗi ca sản xuất hoặc sau khi kết thúc một đơn hàng lớn.',
            'Sử dụng trực tiếp điện thoại di động hoặc máy quét PDA tại xưởng thông qua trang surplus-goods.html?section=... Quét mã QR của lô hàng để tự động điền thông tin nhanh chóng, hạn chế sai sót gõ tay.'
        ],
        [
            'Thủ kho / Nhân viên điều phối',
            'Xuất hàng dư tái sử dụng',
            'Xem lượng hàng dư tồn kho hiện có để điều phối xuất ra tái sử dụng cho các đơn hàng mới, hoặc điều chỉnh sửa lỗi số lượng khi phát hiện sai lệch.',
            'Thực hiện thao tác xuất hàng trực tiếp trên giao diện nhập liệu (nhập số âm hoặc điền số lượng mới nhỏ hơn số lượng cũ). Hệ thống tự ghi nhận lịch sử xuất hàng.'
        ],
        [
            'Ban giám đốc / Quản lý sản xuất',
            'Giám sát tồn kho & Báo cáo',
            'Xem tổng hợp lượng hàng tồn dư giữa các bộ phận, theo dõi biến động hàng ngày nhằm đánh giá hao hụt sản xuất.',
            'Truy cập Dashboard tổng hợp (surplus-dashboard.html), lọc dữ liệu và tải báo cáo Excel về máy tính cá nhân để phân tích số liệu định kỳ.'
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
    const t4_2Header = ws4.addRow(['Nhóm Yêu Cầu', 'Tên Yêu Cầu Chi Tiết', 'Mô Tả Nghiệp Vụ Hàng Dư', 'Giải Pháp Kỹ Thuật / Ghi Chú']);
    t4_2Header.height = 25;
    applyStylesToRange(ws4, t4_2Header.number, 1, t4_2Header.number, 4, {
        font: fontHeader,
        fill: fillHeader,
        border: borderThin,
        alignment: alignCenter
    });
    
    const requirementsData = [
        [
            'Thời gian thực (Realtime)',
            'Đồng bộ dữ liệu tức thời',
            'Khi tổ trưởng bấm "Lưu dữ liệu" tại xưởng, số lượng tồn kho mới và lịch sử giao dịch phải được cập nhật ngay lập tức lên database và hiển thị lên Dashboard.',
            'Dữ liệu được ghi thẳng xuống Supabase qua REST API. Sử dụng kết nối Realtime Channel của Supabase để tự động đẩy sự kiện cập nhật tới các máy tính đang mở trang Dashboard mà không cần tải lại trang.'
        ],
        [
            'Tối ưu thao tác (Auto-focus)',
            'Tự động focus con trỏ chuột',
            'Sau khi lưu dữ liệu thành công hoặc khi quét lỗi, hệ thống phải tự động đặt lại con trỏ chuột vào ô nhập liệu RPRO để công nhân sẵn sàng quét lô tiếp theo.',
            'Sử dụng Javascript: document.getElementById(\'rpro-input\').focus(); ngay sau khi hoàn tất chu trình xử lý dữ liệu.'
        ],
        [
            'Cảnh báo âm thanh (Beep Sound)',
            'Âm thanh phản hồi bíp bíp',
            'Khi quét mã QR hoặc lưu dữ liệu, thiết bị phải phát âm thanh "bíp" thành công (âm cao, ngắn) hoặc thất bại (âm trầm, kéo dài) để công nhân nhận biết kết quả mà không cần nhìn màn hình.',
            'Tích hợp Web Audio API trong Javascript để tự động tạo và phát âm tần số (Frequency-based beep sound) trực tiếp trên trình duyệt thiết bị, tránh lỗi bảo mật chặn phát file mp3 của một số trình duyệt di động.'
        ],
        [
            'Giao diện di động (Mobile Responsive)',
            'Tương thích màn hình nhỏ/PDA',
            'Giao diện phải thân thiện, hiển thị tốt trên màn hình dọc của điện thoại và máy quét PDA cầm tay tại xưởng. Ô nhập size phải đủ lớn để công nhân dễ bấm bằng ngón tay.',
            'Sử dụng Tailwind CSS với thiết kế Grid linh hoạt và các lớp padding/margin lớn cho thiết bị di động. Bảng nhập size được bố trí cuộn ngang mượt mà (overflow-x-auto) kết hợp tính năng di chuyển ô bằng phím Enter/Tab.'
        ],
        [
            'Gợi ý thông minh (Smart Suggest)',
            'Gợi ý tự động hoàn thành',
            'Khi người dùng nhập một phần của mã RPRO, hệ thống phải hiển thị nhanh danh sách gợi ý các mã tương đồng để chọn lựa, hạn chế gõ sai ký tự.',
            'Sử dụng sự kiện input trên trường nhập liệu kết hợp kỹ thuật Debounce và truy vấn giới hạn kết quả (.limit(10)) từ Supabase để hiển thị một khung gợi ý (dropdown menu) nổi phía dưới ô nhập.'
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
    const outputPath = path.join(__dirname, '[Quan li hang du].xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Excel file successfully written to: ${outputPath}`);
}

generateExcel().catch(err => {
    console.error('Error generating Excel:', err);
});
