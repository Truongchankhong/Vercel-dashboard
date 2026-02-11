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
NHIỆM VỤ: Phân tích dữ liệu hệ thống được cung cấp để trả lời người dùng.

TỪ ĐIỂN DỮ LIỆU (Bảng 'powerapp'):
1. KẾ HOẠCH (PPC Plan): Các cột có hậu tố 'PPC' hoặc 'Finish date'.
2. THỰC TẾ (REALTIME / PRO): Các cột có hậu tố 'Pro', 'STORED', 'KHO TAM'.
3. THÔNG TIN KHÁC: 'Brand Code', 'PRO ODER', 'Article Name', 'Total Qty', 'Delay-Urgent'.

NGUYÊN TẮC QUAN TRỌNG:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN. Chỉ nói những gì thấy trong phần [DỮ LIỆU].
2. Nếu dữ liệu trống, hãy thông báo rằng hệ thống hiện không tìm thấy đơn hàng nào khớp, KHÔNG ĐƯỢC hỏi người dùng cung cấp bảng dữ liệu vì bạn là người đang truy cập hệ thống.
3. Trả lời súc tích, chuyên nghiệp bằng tiếng Việt.`;

export async function generateAIResponse(prompt, extraContext = "") {
    let dataContext = "";
    if (extraContext) {
        dataContext += `[CONTEXT NGƯỜI DÙNG CUNG CẤP]:\n${extraContext}\n\n`;
    }

    try {
        const queryLower = prompt.toLowerCase();
        const now = new Date();
        const todayStr = now.toLocaleDateString('vi-VN');

        dataContext += `[THỜI ĐIỂM BÁO CÁO]: ${todayStr}\n`;

        // 1. Snapshot tổng quát (Dùng .count() để lấy số lượng thực tế trên toàn database)
        console.log("📊 Đang đếm số lượng đơn trễ/gấp...");
        const [delayCountRes, urgentCountRes] = await Promise.all([
            supabase.from('powerapp').select('*', { count: 'exact', head: true }).ilike('Delay-Urgent', '%DELAY%'),
            supabase.from('powerapp').select('*', { count: 'exact', head: true }).ilike('Delay-Urgent', '%URGENT%')
        ]);

        const delay = delayCountRes.count || 0;
        const urgent = urgentCountRes.count || 0;
        dataContext += `[TỔNG QUAN HỆ THỐNG]: Đang có ${delay} đơn Trễ (Delay) và ${urgent} đơn Gấp (Urgent) trên toàn hệ thống.\n`;

        // 2. Thống kê thương hiệu (NIKE, ADIDAS, PUMA, etc.)
        const brands = ["NIKE", "ADIDAS", "PUMA", "ASICS", "NB", "BROOKS", "ON RUNNING"];
        const bFound = brands.find(b => queryLower.includes(b.toLowerCase()));

        if (bFound) {
            console.log(`🔍 Truy xuất dữ liệu cho Brand: ${bFound}...`);
            // Quote các cột có dấu cách để PostgREST không lỗi
            const { data: bData, error: bError } = await supabase
                .from('powerapp')
                .select('"PRO ODER", "Brand Code", STATUS, "Finish date", "Total Qty", "Delay-Urgent"')
                .ilike('Brand Code', `%${bFound}%`)
                .order('STT', { ascending: false })
                .limit(20);

            if (bError) {
                console.error("❌ Lỗi truy vấn Brand:", bError.message);
            } else if (bData && bData.length > 0) {
                // Lấy tổng số lượng của riêng Brand này (Query riêng để chính xác)
                const { data: totalData } = await supabase
                    .from('powerapp')
                    .select('"Total Qty"')
                    .ilike('Brand Code', `%${bFound}%`);

                const totalQty = totalData?.reduce((s, o) => s + (parseFloat(String(o['Total Qty'] || '0').replace(/,/g, '')) || 0), 0) || 0;
                const delayBrandCount = totalData?.filter(o => String(o['Delay-Urgent'] || '').toUpperCase().includes('DELAY')).length || 0;

                dataContext += `\n[DỮ LIỆU BRAND ${bFound}]:
- Tổng số đơn hàng: ${totalData?.length || 0} đơn.
- Tổng số lượng: ${totalQty.toLocaleString()} đôi/chiếc.
- Số đơn bị trễ: ${delayBrandCount} đơn.
- Chi tiết 20 đơn mới nhất của ${bFound}:\n${JSON.stringify(bData, null, 2)}`;
            } else {
                dataContext += `\n[THÔNG BÁO]: Không tìm thấy đơn hàng nào của thương hiệu ${bFound} trong hệ thống hiện tại.`;
            }
        }

        // 3. Tra cứu theo RPRO cụ thể
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            console.log(`🔍 Tra cứu đơn cụ thể: ${searchRpro}...`);
            const { data: order } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
            if (order) {
                dataContext += `\n\n[DỮ LIỆU CHI TIẾT ĐƠN ${searchRpro}]:\n${JSON.stringify(order, null, 2)}`;
            }
        }

        // 4. Bổ sung 10 đơn hàng "Gấp" mới nhất nếu không có brand cụ thể
        if (!bFound && !rproMatch) {
            const { data: urgentList } = await supabase
                .from('powerapp')
                .select('"PRO ODER", "Brand Code", "Finish date"')
                .ilike('Delay-Urgent', '%URGENT%')
                .limit(10);
            if (urgentList) {
                dataContext += `\n\n[DANH SÁCH ĐƠN GẤP TIÊU BIỂU]:\n${JSON.stringify(urgentList)}`;
            }
        }

    } catch (dbErr) {
        console.warn("⚠️ Lỗi database tổng quát:", dbErr.message);
    }

    // Danh sách model ưu tiên
    const candidateModels = [
        "gemini-2.0-flash", // Ưu tiên bản ổn định nhanh
        "gemini-1.5-flash",
        "gemini-3-flash-preview",
        "gemini-3-pro-preview"
    ];

    for (const modelName of candidateModels) {
        try {
            console.log(`🤖 Đang gửi dữ liệu cho AI (Model: ${modelName})...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU HỆ THỐNG]:\n${dataContext}\n\n[CÂU HỎI NGƯỜI DÙNG]: ${prompt}`;

            const result = await model.generateContent(finalPrompt);
            return result.response.text();
        } catch (err) {
            console.warn(`❌ Model ${modelName} lỗi hoặc hết quota:`, err.message);
            if (modelName === candidateModels[candidateModels.length - 1]) {
                return "🤖 [Hệ thống]: Không kết nối được bộ não AI (Gemini). Bạn vui lòng thử lại sau 1 phút hoặc hỏi mã đơn khác nhé!";
            }
        }
    }
}
