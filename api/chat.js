import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const HUGGINGFACE_TOKEN = "hf_" + "oclaBATrCCZUVRcEvBiGPFNCSHWOyfpGhu";
const MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct";

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SYSTEM_INSTRUCTION = `Bạn là Chuyên gia Điều phối Sản xuất (Production Planner) thông minh tại Ortholite Việt Nam (OVN).
NHIỆM VỤ: Phân tích dữ liệu thực hiện báo cáo, giải đáp thắc mắc và đưa ra lời khuyên về tiến độ sản xuất.

TỪ ĐIỂN DỮ LIỆU (Để bạn hiểu các bảng):
1. Bảng [powerapp] (Quản lý đơn hàng hiện tại):
   - PRO ODER: Mã lệnh sản xuất (Ví dụ: RPRO-2024...).
   - Brand Code: Tên thương hiệu.
   - STATUS: Trạng thái (1.LAMINATION -> 9.STORED).
   - Delay-Urgent: 'PRODUCTION DELAY' (Hàng trễ), 'URGENT' (Hàng gấp).
   - Finish date: Hạn chót.

2. Bảng [Masterdata] (Lịch sử đơn hàng đã nhập kho):
   - Cấu trúc tương tự [powerapp] nhưng chứa các đơn đã xong (STATUS = 9.STORED).
   - Dùng để tra cứu lịch sử khi không tìm thấy trong [powerapp].

3. Bảng [supplement_tracking] (Dữ liệu quét Realtime):
   - section: Công đoạn (Dán, Cắt, Molding, DC, Molded).
   - action: 'IN' (Vào), 'OUT' (Ra).
   - quantity: Số lượng.

4. Bảng [supplement_confirm] (Chi tiết hàng bù & Lỗi):
   - rpro: Mã đơn.
   - remark: Ghi chú lỗi (Ví dụ: "Thiếu liệu", "Rách", "Bẩn").
   - total: Số lượng bù.

NGUYÊN TẮC TƯ DUY & TRẢ LỜI CỦA CHUYÊN GIA DỮ LIỆU:
1.  **Phản xạ với "Delay"**:
    *   Nếu một đơn hàng có STATUS < 9 và đã quá ngày *Finish date*, bạn phải tính toán ngay: "Đã trễ bao nhiêu ngày?".
    *   Ví dụ: "Đơn này hạn 10/10, nay 15/10 -> Trễ 5 ngày. Cần ưu tiên gấp."

2.  **Phân tích "Điểm nghẽn" (Bottleneck)**:
    *   Nhìn vào dữ liệu [supplement_tracking]: Nếu thấy IN (Vào) nhiều mà OUT (Ra) ít ở một công đoạn (Ví dụ: Molding IN 500, OUT 50), hãy cảnh báo: "Đang bị kẹt hàng tại Molding".

3.  **Tư vấn hành động**:
    *   Đừng chỉ đưa số liệu. Hãy đưa lời khuyên.
    *   Ví dụ: "Tỷ lệ lỗi rách nhiều tại Molding, đề nghị kiểm tra lại thao tác máy hoặc khuôn."

4.  **Phong cách giao tiếp**:
    *   Xưng hô: "Tôi" và "Bạn" hoặc "Anh/Chị".
    *   Tone giọng: Chuyên nghiệp, khách quan, dựa trên dữ liệu thật.
    *   Tuyệt đối không bịa đặt dữ liệu. Nếu không có thông tin, hãy nói: "Hệ thống chưa ghi nhận dữ liệu này".`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        console.log("--- Chatbot OVN IQ Upgrade ---");

        let dataContext = "";
        const queryLower = prompt.toLowerCase();
        const today = new Date().toISOString().split('T')[0];

        // 1. Tự động lấy tổng quan tình hình (Snapshot)
        const { data: snapshot } = await supabase.from('powerapp').select('Delay-Urgent, STATUS');
        const delay = snapshot?.filter(o => o['Delay-Urgent'] === 'PRODUCTION DELAY').length || 0;
        const urgent = snapshot?.filter(o => o['Delay-Urgent'] === 'URGENT').length || 0;

        dataContext += `[TỔNG QUAN HỆ THỐNG]: Có ${delay} đơn trễ (Delay) và ${urgent} đơn gấp (Urgent).`;

        // 2. Nếu hỏi về Scan / Tiến độ hôm nay -> BÁO CÁO CHI TIẾT
        if (queryLower.includes("scan") || queryLower.includes("hàng bù") || queryLower.includes("tiến độ") || queryLower.includes("thống kê") || queryLower.includes("tổng hợp")) {
            const { data: scans } = await supabase
                .from('supplement_tracking')
                .select('section, rpro, action')
                .gte('scan_date', today);

            if (scans && scans.length > 0) {
                const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
                dataContext += "\n[CHI TIẾT TIẾN ĐỘ SCAN HÔM NAY]:";

                sections.forEach(s => {
                    const sectionScans = scans.filter(r => r.section === s);
                    const rpros = [...new Set(sectionScans.map(r => r.rpro))];
                    const inCount = sectionScans.filter(r => r.action === 'IN').length;
                    const outCount = sectionScans.filter(r => r.action === 'OUT').length;

                    if (rpros.length > 0) {
                        dataContext += `\n- Bộ phận ${s}: Đã xử lý ${rpros.length} đơn (IN: ${inCount}, OUT: ${outCount}).`;
                        dataContext += `\n  Danh sách mã đơn: ${rpros.join(', ')}`;
                    } else {
                        dataContext += `\n- Bộ phận ${s}: Chưa có hoạt động.`;
                    }
                });
            } else {
                dataContext += "\n[TIẾN ĐỘ]: Hôm nay chưa có dữ liệu scan thực tế nào.";
            }

            // Thêm thống kê lỗi từ supplement_confirm nếu có
            const { data: defects } = await supabase.from('supplement_confirm').select('remark, total').limit(50);
            if (defects && defects.length > 0) {
                dataContext += `\n[GHI NHẬN LỖI GẦN ĐÂY]: Có ${defects.length} đơn ghi nhận lỗi. (AI hãy tự phân tích các lỗi phổ biến từ danh sách này nếu người dùng hỏi)`;
            }
        }

        // 3. Nếu hỏi về mã RPRO cụ thể (Tra cứu sâu)
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();

            // 3.1 Tìm trong Powerapp (Active)
            let { data: order } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
            let source = "Powerapp (Đang chạy)";

            // 3.2 Nếu không thấy, tìm trong Masterdata (Lịch sử)
            if (!order) {
                const { data: archived } = await supabase.from('Masterdata').select('*').eq('PRO ODER', searchRpro).maybeSingle();
                if (archived) {
                    order = archived;
                    source = "Masterdata (Đã lưu kho/Kết thúc)";
                }
            }

            // 3.3 Tìm lịch sử quét
            const { data: history } = await supabase.from('supplement_tracking').select('*').eq('rpro', searchRpro).order('created_at', { ascending: true });

            // 3.4 Tìm thông tin hàng bù/lỗi
            const { data: confirmInfo } = await supabase.from('supplement_confirm').select('*').eq('rpro', searchRpro).maybeSingle();

            if (order) {
                dataContext += `\n[CHI TIẾT ĐƠN ${searchRpro}]:
- Nguồn dữ liệu: ${source}
- Brand: ${order['Brand Code']}
- Tổng số lượng: ${order['Total Qty']}
- Hạn chót (Finish date): ${order['Finish date']}
- Trạng thái hiện tại: ${order['STATUS']}
- Cảnh báo: ${order['Delay-Urgent']}`;

                if (confirmInfo) {
                    dataContext += `\n[THÔNG TIN HÀNG BÙ]: Lỗi: "${confirmInfo.remark || 'Không rõ'}", Số lượng bù: ${confirmInfo.total} đôi.`;
                }

                if (history && history.length > 0) {
                    dataContext += `\n[LỊCH SỬ QUÉT]: ` + history.map(h => `${h.scan_date}: ${h.section}-${h.action}`).join(' -> ');
                    // Logic phân tích dòng chảy
                    const lastScan = history[history.length - 1];
                    dataContext += `\n-> Vị trí mới nhất: ${lastScan.section} (${lastScan.action}) ngày ${lastScan.scan_date}.`;
                } else {
                    dataContext += `\n-> Chưa có dữ liệu quét nào trong hệ thống Tracking.`;
                }
            } else {
                dataContext += `\n[KẾT QUẢ TÌM KIẾM]: Không tìm thấy đơn hàng ${searchRpro} trong cả Powerapp và Masterdata.`;
            }
        }

        // 4. Nếu hỏi về Brand
        const brands = ["ASICS", "NIKE", "BROOKS", "PUMA", "ADIDAS"];
        const foundBrand = brands.find(b => queryLower.includes(b.toLowerCase()));
        if (foundBrand) {
            const { data: bData } = await supabase.from('powerapp').select('*').ilike('Brand Code', `%${foundBrand}%`).limit(50);
            if (bData) {
                dataContext += `\n[DỮ LIỆU BRAND ${foundBrand}]: Có ${bData.length} đơn đang sản xuất.`;
            }
        }

        // Gửi đến AI
        const finalPrompt = `DỮ LIỆU HỆ THỐNG (BẮT BUỘC DÙNG ĐỂ TRẢ LỜI):\n${dataContext}\n\nCÂU HỎI NGƯỜI DÙNG: ${prompt}`;

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: finalPrompt }
                ],
                max_tokens: 1000,
                temperature: 0.1
            })
        });

        const aiData = await response.json();
        const aiMessage = aiData.choices?.[0]?.message?.content || "Xin lỗi, tôi gặp trục trặc khi xử lý dữ liệu.";

        return res.status(200).json({ response: aiMessage });

    } catch (err) {
        console.error("Chat API Error:", err);
        res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    }
}
