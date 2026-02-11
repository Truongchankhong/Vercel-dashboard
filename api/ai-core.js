import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURATION ---
const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
const GEMINI_API_KEY = "AIzaSyBdfvhY3nU2Ung11JBlErZLiwC0J2i4kNM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- SYSTEM PROMPT ---
const SYSTEM_INSTRUCTION = `Bạn là Chuyên gia Điều phối Sản xuất (Production Planner) thông minh tại Ortholite Việt Nam (OVN). 
NHIỆM VỤ: Phân tích dữ liệu hệ thống để trả lời chính xác nhất.

TỪ ĐIỂN DỮ LIỆU (Bảng 'powerapp'):
1. KẾ HOẠCH (PPC Plan): Các cột có hậu tố 'PPC' hoặc 'Finish date'.
2. THỰC TẾ (REALTIME / PRO): Các cột có hậu tố 'Pro', 'STORED', 'KHO TAM'.
3. THÔNG TIN KHÁC: 'Brand Code', 'PRO ODER', 'Article Name', 'Total Qty', 'Delay-Urgent'.

NGUYÊN TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN.
2. Trả lời dựa trên dữ liệu hệ thống được cung cấp.
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

        dataContext += `[NGÀY HIỆN TẠI]: ${todayStr}\n`;

        // 1. Snapshot tổng quát
        const { data: snapshot } = await supabase.from('powerapp').select('Delay-Urgent');
        const delay = snapshot?.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('DELAY')).length || 0;
        const urgent = snapshot?.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('URGENT')).length || 0;
        dataContext += `[TỔNG QUAN HỆ THỐNG]: ${delay} đơn Trễ, ${urgent} đơn Gấp.\n`;

        // 2. Thống kê thương hiệu (NIKE, ADIDAS, etc.)
        const brands = ["NIKE", "ADIDAS", "PUMA", "ASICS", "NB", "NEW BALANCE", "BROOKS", "ON RUNNING"];
        const bFound = brands.find(b => queryLower.includes(b.toLowerCase()));

        if (bFound) {
            const { data: bData } = await supabase
                .from('powerapp')
                .select('PRO ODER, Brand Code, STATUS, Finish date, "Total Qty", Delay-Urgent')
                .ilike('Brand Code', `%${bFound}%`);

            if (bData && bData.length > 0) {
                const totalQty = bData.reduce((s, o) => s + (parseFloat(String(o['Total Qty'] || '0').replace(/,/g, '')) || 0), 0);
                const delayCount = bData.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('DELAY')).length;
                dataContext += `\n[DỮ LIỆU BRAND ${bFound}]:
- Tổng số đơn: ${bData.length} đơn.
- Tổng số lượng: ${totalQty.toLocaleString()} đôi/chiếc.
- Số đơn bị trễ: ${delayCount} đơn.
- Một số đơn tiêu biểu: ${bData.slice(0, 5).map(i => i['PRO ODER']).join(', ')}...`;
            }
        }

        // 3. Chi tiết đơn RPRO
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            const { data: order } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
            if (order) {
                dataContext += `\n\n[DỮ LIỆU CHI TIẾT ĐƠN ${searchRpro}]:\n${JSON.stringify(order, null, 2)}`;
            }
        }
    } catch (dbErr) {
        console.warn("⚠️ Lỗi database:", dbErr.message);
    }

    // Danh sách model ưu tiên
    const candidateModels = [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ];

    for (const modelName of candidateModels) {
        try {
            console.log(`🤖 Kích hoạt Gemini: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU]:\n${dataContext}\n\n[CÂU HỎI]: ${prompt}`;
            const result = await model.generateContent(finalPrompt);
            return result.response.text();
        } catch (err) {
            console.warn(`❌ Model ${modelName} lỗi:`, err.message);
            if (modelName === candidateModels[candidateModels.length - 1]) {
                return "🤖 [Hệ thống]: Không kết nối được bộ não Gemini. Vui lòng thử lại sau!";
            }
        }
    }
}
