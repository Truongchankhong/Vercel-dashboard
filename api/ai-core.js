import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// --- CONFIGURATION ---
const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

// Hugging Face config
const HF_TOKEN = "hf_" + "oclaBATrCCZUVRcEvBiGPFNCSHWOyfpGhu";
const MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SYSTEM PROMPT ---
const SYSTEM_INSTRUCTION = `Bạn là Chuyên gia Điều phối Sản xuất (Production Planner) thông minh tại Ortholite Việt Nam (OVN). 
NHIỆM VỤ: Phân tích dữ liệu hệ thống để trả lời chính xác nhất.

TỪ ĐIỂN DỮ LIỆU (Bảng 'powerapp'):
1. KẾ HOẠCH (PPC Plan): Các cột có hậu tố 'PPC' hoặc 'Finish date'.
2. THỰC TẾ (REALTIME / PRO): Các cột có hậu tố 'Pro', 'STORED', 'KHO TAM'.
3. THÔNG TIN KHÁC: 'Brand Code', 'PRO ODER', 'Article Name', 'Total Qty', 'Delay-Urgent'.

NGUYÊN TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN.
2. Trả lời ngay lập tức bằng số liệu được cung cấp. CÁM giải thích cách tra cứu hoặc lý do không có quyền.
3. Nếu không tìm thấy dữ liệu, hãy trả lời: "Tôi xin lỗi, tôi không tìm thấy dữ liệu cho yêu cầu này trong hệ thống hiện tại."`;

export async function generateAIResponse(prompt, extraContext = "") {
    let dataContext = "";
    if (extraContext) {
        dataContext += `[CONTEXT TỪ TRANG WEB]:\n${extraContext}\n\n`;
    }

    try {
        const queryLower = prompt.toLowerCase();
        const now = new Date();
        const todayStr = now.toLocaleDateString('vi-VN');

        dataContext += `[THỜI ĐIỂM BÁO CÁO]: ${todayStr}\n`;

        // 1. Snapshot tổng quát (Đếm tổng Delay/Urgent trên toàn table)
        const { data: snapshot } = await supabase.from('powerapp').select('Delay-Urgent');
        const delay = snapshot?.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('DELAY')).length || 0;
        const urgent = snapshot?.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('URGENT')).length || 0;
        dataContext += `[TỔNG QUAN HỆ THỐNG]: Đang có ${delay} đơn Trễ (Delay), ${urgent} đơn Gấp (Urgent).\n`;

        // 2. NHẬN DIỆN THƯƠNG HIỆU & THỐNG KÊ CHI TIẾT
        const brands = ["NIKE", "ADIDAS", "PUMA", "ASICS", "NB", "NEW BALANCE", "BROOKS", "ON RUNNING"];
        const brandFound = brands.find(b => queryLower.includes(b.toLowerCase()));

        if (brandFound) {
            console.log(`🔍 Đang truy xuất dữ liệu đầy đủ cho Brand: ${brandFound}...`);
            // Lấy tất cả các đơn của Brand này để tính tổng chính xác
            const { data: bData } = await supabase
                .from('powerapp')
                .select('PRO ODER, Brand Code, STATUS, Finish date, "Total Qty", Delay-Urgent')
                .ilike('Brand Code', `%${brandFound}%`);

            if (bData && bData.length > 0) {
                const totalOrders = bData.length;
                const totalQty = bData.reduce((s, o) => s + (parseFloat(String(o['Total Qty'] || '0').replace(/,/g, '')) || 0), 0);
                const delayOrders = bData.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('DELAY')).length;

                dataContext += `\n[DỮ LIỆU BRAND ${brandFound}]:
- Tổng số đơn hàng: ${totalOrders} đơn.
- Tổng số lượng sản phẩm: ${totalQty.toLocaleString()} đôi/chiếc.
- Số đơn đang bị trễ: ${delayOrders} đơn.
- Một số đơn tiêu biểu: ${bData.slice(0, 5).map(i => i['PRO ODER']).join(', ')}...`;
            } else {
                dataContext += `\n[THÔNG BÁO]: Hiện không tìm thấy bất kỳ đơn hàng nào của thương hiệu ${brandFound} trong hệ thống.`;
            }
        }

        // 3. Tra cứu theo RPRO cụ thể
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            const { data: order } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
            if (order) {
                dataContext += `\n\n[DỮ LIỆU CHI TIẾT ĐƠN ${searchRpro}]:\n${JSON.stringify(order, null, 2)}`;
            }
        }

        // 4. Báo cáo kế hoạch (Snapshot 20 đơn mới nhất nếu không có brand cụ thể)
        if (!brandFound && !rproMatch) {
            const { data: recent } = await supabase.from('powerapp').select('PRO ODER, Brand Code, STATUS, Finish date').limit(20);
            if (recent) {
                dataContext += `\n\n[DANH SÁCH ĐƠN HÀNG GẦN ĐÂY]:\n${JSON.stringify(recent)}`;
            }
        }

    } catch (dbErr) {
        console.warn("⚠️ Lỗi database:", dbErr.message);
    }

    // --- GỌI HUGGING FACE API (QWEN 2.5) ---
    try {
        console.log(`🤖 Đang hỏi Qwen 2.5 (Hugging Face)...`);
        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: `DỮ LIỆU HỆ THỐNG:\n${dataContext}\n\n----------\nCÂU HỎI: ${prompt}` }
                ],
                max_tokens: 1024,
                temperature: 0.1,
                stream: false
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data.choices[0].message.content;

    } catch (err) {
        console.error(`❌ Lỗi AI:`, err.message);
        return "🤖 [Hệ thống]: Không kết nối được bộ não AI. Vui lòng thử lại sau giây lát hoặc báo IT kiểm tra HF_TOKEN.";
    }
}
