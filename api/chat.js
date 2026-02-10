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
1. Bảng [powerapp] (Quản lý đơn hàng):
   - PRO ODER: Mã lệnh sản xuất (Ví dụ: RPRO-2024...).
   - Brand Code: Tên thương hiệu (Nike, Adidas, Puma, Brooks, Asics...).
   - STATUS: Quy trình từ 1.LAMINATION đến 9.STORED (9 là xong).
   - Delay-Urgent: 'PRODUCTION DELAY' (Hàng trễ), 'URGENT' (Hàng gấp). 'NORMAL' (Bình thường).
   - Finish date: Hạn chót phải hoàn thành.

2. Bảng [supplement_tracking] (Dữ liệu quét hàng bù Realtime):
   - section: Công đoạn (Dán, Cắt, Molding, DC, Molded).
   - action: 'IN' (Bắt đầu làm), 'OUT' (Xong công đoạn đó).
   - quantity: Số lượng đôi.

NGUYÊN TẮC TRẢ LỜI:
- Trả lời bằng tiếng Việt, chuyên nghiệp, súc tích.
- Khi người dùng hỏi về thống kê, hãy dùng con số cụ thể từ mục [DỮ LIỆU HỆ THỐNG].
- Nếu đơn hàng có STATUS chưa phải là 9 mà đã qua ngày Finish date, hãy nhắc nhở là CỰC KỲ TRỄ.
- Nếu người dùng yêu cầu 'danh sách' hoặc 'chi tiết', hãy liệt kê rõ ràng các mã đơn.
- Tuyệt đối không nói 'tôi không có quyền truy cập' vì dữ liệu đã được cung cấp ngay bên dưới câu hỏi.`;

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

        // 2. Nếu hỏi về Scan / Tiến độ hôm nay
        if (queryLower.includes("scan") || queryLower.includes("hàng bù") || queryLower.includes("tiến độ") || queryLower.includes("thống kê")) {
            const { data: scans } = await supabase
                .from('supplement_tracking')
                .select('section, rpro, action')
                .gte('scan_date', today);

            if (scans && scans.length > 0) {
                const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
                dataContext += "\n[TIẾN ĐỘ SCAN HÔM NAY]:";
                sections.forEach(s => {
                    const rpros = [...new Set(scans.filter(r => r.section === s).map(r => r.rpro))];
                    if (rpros.length > 0) {
                        dataContext += `\n- ${s}: ${rpros.length} đơn. Danh sách mã: ${rpros.join(', ')}`;
                    }
                });
            } else {
                dataContext += "\n- Hôm nay chưa có dữ liệu scan thực tế.";
            }
        }

        // 3. Nếu hỏi về mã RPRO cụ thể
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            const { data: order } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
            const { data: history } = await supabase.from('supplement_tracking').select('*').eq('rpro', searchRpro).order('created_at', { ascending: true });

            if (order) {
                dataContext += `\n[CHI TIẾT ĐƠN ${searchRpro}]: Brand: ${order['Brand Code']}, Qty: ${order['Total Qty']}, Hạn: ${order['Finish date']}, Trạng thái: ${order['STATUS']}.`;
                if (history && history.length > 0) {
                    dataContext += `\nLịch sử scan: ` + history.map(h => `${h.section}-${h.action}`).join(' -> ');
                }
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
