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

NGUYÊN TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN (HALLUCINATION).
2. Chỉ trả lời dựa trên phần [DỮ LIỆU] được cung cấp. 
3. Nếu không có dữ liệu cho mã đơn RPRO hoặc không thấy số liệu liên quan, hãy trả lời: "Tôi xin lỗi, tôi không tìm thấy dữ liệu cho mã này trong hệ thống hiện tại."
4. Trả lời súc tích, Tiếng Việt chuyên nghiệp.`;

export async function generateAIResponse(prompt) {
    let dataContext = "";
    try {
        const queryLower = prompt.toLowerCase();
        const now = new Date();
        const todayStr = now.toLocaleDateString('vi-VN');
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentYear = now.getFullYear();

        dataContext += `[NGÀY HIỆN TẠI]: ${todayStr}\n`;

        // 1. Snapshot tổng quát
        const { data: snapshot } = await supabase.from('powerapp').select('Delay-Urgent');
        const delay = snapshot?.filter(o => o['Delay-Urgent'] === 'PRODUCTION DELAY').length || 0;
        const urgent = snapshot?.filter(o => o['Delay-Urgent'] === 'URGENT').length || 0;
        dataContext += `[TỔNG QUAN HỆ THỐNG]: ${delay} đơn Trễ, ${urgent} đơn Gấp.`;

        // 2. NHẬN DIỆN TRUY VẤN DANH SÁCH & THỐNG KÊ (NÂNG CẤP)
        const brandMatch = prompt.match(/(NIKE|ADIDAS|PUMA|ASICS|NB|NEW BALANCE)/i);
        const isRequestingSummary = queryLower.includes("danh sách") || queryLower.includes("số lượng") || queryLower.includes("bao nhiêu") || queryLower.includes("tổng") || queryLower.includes("liệt kê");

        if (brandMatch || isRequestingSummary) {
            const brand = brandMatch ? brandMatch[0].toUpperCase() : null;
            console.log(`🔍 Đang phân tích thống kê cho Brand: ${brand || 'TẤT CẢ'}...`);

            // Lấy 50 đơn hàng gần nhất để AI tự thống kê (vì không thể làm SQL phức tạp ngay lập tức)
            let query = supabase.from('powerapp').select('PRO ODER, Brand Code, STATUS, Finish date, Quantity');

            if (brand) {
                query = query.ilike('Brand Code', `%${brand}%`);
            }

            // Nếu người dùng nhắc đến trạng thái cụ thể (ví dụ: 9.STORED)
            const statusMatch = prompt.match(/\d\.[A-Z]+/i);
            if (statusMatch) {
                // SỬA LỖI: Dùng ilike và % để tìm gần đúng (ví dụ tìm "9.STORED" thì khớp cả "9.STORED" có khoảng trắng)
                // Hoặc tìm theo đầu số (ví dụ: 9.)
                const statusKey = statusMatch[0].toUpperCase();
                // Nếu tìm "9.STORED" -> tìm "9.%" để bao quát hết
                const statusPrefix = statusKey.split('.')[0];
                query = query.ilike('STATUS', `${statusPrefix}.%`);
            }

            const { data: list } = await query.order('Finish date', { ascending: false }).limit(50);

            if (list && list.length > 0) {
                const totalQty = list.reduce((sum, item) => sum + (Number(item.Quantity) || 0), 0);
                dataContext += `\n[DỮ LIỆU THỐNG KÊ ${brand || ''}]:
- Tổng số đơn hàng tìm thấy: ${list.length} đơn.
- Tổng số lượng sản phẩm: ${totalQty} đôi/chiếc.
- Trạng thái các đơn: ${[...new Set(list.map(i => i.STATUS))].join(', ')}
- Danh sách một số mã đơn: ${list.slice(0, 5).map(i => i['PRO ODER']).join(', ')}...`;
            } else {
                dataContext += `\n[THUYẾT MINH]: Không tìm thấy đơn hàng nào khớp với các tiêu chí (Brand: ${brand || 'N/A'}, Status: ${statusMatch ? statusMatch[0] : 'N/A'}).`;
            }
        }

        // 3. Chi tiết đơn hàng RPRO cụ thể (giữ nguyên)
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            const [{ data: order }, { data: confirm }, { data: scans }] = await Promise.all([
                supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle(),
                supabase.from('supplement_confirm').select('*').eq('rpro', searchRpro).maybeSingle(),
                supabase.from('supplement_tracking').select('section, action, scan_date').eq('rpro', searchRpro).order('created_at', { ascending: false }).limit(5)
            ]);

            if (order) {
                dataContext += `\n[CHI TIẾT ĐƠN ${searchRpro}]: Brand ${order['Brand Code']}, Article: ${order['Article Name']}, Status: Level ${order['STATUS']}, Hạn: ${order['Finish date']}.`;
                if (confirm) dataContext += `\n- Bù hàng: ${confirm.remark} (${confirm.total} đôi).`;
                if (scans && scans.length > 0) dataContext += `\n- Lịch sử quét: ` + scans.map(s => `${s.section}(${s.action})`).join(' -> ');
            }
        }
    } catch (dbErr) {
        console.warn("⚠️ Lỗi database:", dbErr.message);
    }

    // Danh sách model ưu tiên (Bản cao cấp hơn)
    const candidateModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro-latest",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash"
    ];

    for (const modelName of candidateModels) {
        try {
            console.log(`🤖 Kích hoạt bộ não: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });

            // Gửi yêu cầu cho AI
            const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU]:\n${dataContext}\n\n[CÂU HỎI]: ${prompt}`;
            const result = await model.generateContent(finalPrompt);
            return result.response.text();

        } catch (err) {
            console.warn(`❌ Model ${modelName} lỗi:`, err.message);
            if (modelName === candidateModels[candidateModels.length - 1]) {
                return "🤖 [Hệ thống]: Không kết nối được bộ não AI. Bạn đợi xíu hoặc hỏi lại nhé!";
            }
        }
    }
}
