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
- "PRO ODER": Mã đơn hàng sản xuất (Người dùng thường gọi là RPRO).
- "SO": Mã vận đơn / Đơn hàng bán (Sales Order).
- "Brand Code": Mã thương hiệu (NIKE, ADIDAS, PUMA...).
- "CUSTOMERS": Tên khách hàng (Người dùng thường gọi là Customer).
- "Total Qty": Tổng số lượng sản phẩm.
- "Article Name": Tên sản phẩm / Article.
- "STATUS": Các mức level xử lý (10.RECEIVED -> 9.STORED...).
- "Delay-Urgent": Tình trạng đơn hàng (PRODUCTION DELAY hoặc URGENT).
- "Finish date": Ngày hoàn thành theo kế hoạch.

NGUYÊN TẮC QUAN TRỌNG:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN. Chỉ nói những gì thấy trong phần [DỮ LIỆU].
2. Nếu người dùng hỏi "RPRO", "Customer" hãy tự hiểu đó là cột "PRO ODER" và "CUSTOMERS".
3. Trả lời súc tích, chuyên nghiệp bằng tiếng Việt.
4. KHÔNG ĐƯỢC hỏi người dùng cung cấp thêm bảng dữ liệu.`;

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

        // 1. Snapshot tổng quát (Số đơn trễ/gấp)
        const [delayCountRes, urgentCountRes] = await Promise.all([
            supabase.from('powerapp').select('*', { count: 'exact', head: true }).ilike('Delay-Urgent', '%DELAY%'),
            supabase.from('powerapp').select('*', { count: 'exact', head: true }).ilike('Delay-Urgent', '%URGENT%')
        ]);
        dataContext += `[TỔNG QUAN]: ${delayCountRes.count || 0} đơn Trễ, ${urgentCountRes.count || 0} đơn Gấp.\n`;

        // 2. NHẬN DIỆN THƯƠNG HIỆU & KHÁCH HÀNG (Tra cứu Brand/Customer)
        const brands = ["NIKE", "ADIDAS", "PUMA", "ASICS", "NB", "BROOKS", "ON RUNNING"];
        const bFound = brands.find(b => queryLower.includes(b.toLowerCase()));

        if (bFound) {
            const { data: bData } = await supabase
                .from('powerapp')
                .select('"PRO ODER", "SO", "Brand Code", "CUSTOMERS", "Article Name", "Total Qty", "Delay-Urgent", "Finish date"')
                .ilike('Brand Code', `%${bFound}%`)
                .order('STT', { ascending: false })
                .limit(15);

            if (bData && bData.length > 0) {
                dataContext += `\n[DANH SÁCH ĐƠN ${bFound}]:\n${JSON.stringify(bData, null, 2)}`;
            }
        }

        // 3. Tra cứu theo RPRO (PRO ODER) hoặc SO
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        const soMatch = prompt.match(/SO-[\d-]+/i);

        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            const { data: order } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
            if (order) dataContext += `\n\n[CHI TIẾT ĐƠN ${searchRpro}]:\n${JSON.stringify(order, null, 2)}`;
        } else if (soMatch) {
            const searchSo = soMatch[0].toUpperCase();
            const { data: orders } = await supabase.from('powerapp').select('*').eq('SO', searchSo).limit(5);
            if (orders) dataContext += `\n\n[DANH SÁCH THEO SO ${searchSo}]:\n${JSON.stringify(orders, null, 2)}`;
        }

    } catch (dbErr) {
        console.warn("⚠️ Lỗi database:", dbErr.message);
    }

    const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash"];

    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU HỆ THỐNG]:\n${dataContext}\n\n[CÂU HỎI]: ${prompt}`;
            const result = await model.generateContent(finalPrompt);
            return result.response.text();
        } catch (err) {
            if (modelName === candidateModels[candidateModels.length - 1]) {
                return "🤖 [Hệ thống]: Không kết nối được AI. Vui lòng thử lại sau!";
            }
        }
    }
}
