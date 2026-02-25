import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// --- CONFIGURATION ---
const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
const GEMINI_API_KEY = "AIzaSyBdfvhY3nU2Ung11JBlErZLiwC0J2i4kNM";

// Hugging Face config (Phòng hờ khi Gemini hết quota)
const HF_TOKEN = "hf_" + "oclaBATrCCZUVRcEvBiGPFNCSHWOyfpGhu";
const MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- SYSTEM PROMPT ---
const SYSTEM_INSTRUCTION = `Bạn là Chuyên gia Điều phối Sản xuất (Production Planner) thông minh tại Ortholite Việt Nam (OVN). 
NHIỆM VỤ: Phân tích dữ liệu hệ thống được cung cấp để trả lời người dùng.

TỪ ĐIỂN DỮ LIỆU:
1. Bảng 'powerapp' (Dữ liệu tổng):
   - "PRO ODER": Mã đơn hàng sản xuất (người dùng gọi là RPRO).
   - "SO": Mã vận đơn / Đơn hàng bán.
   - "Brand Code": Mã thương hiệu (NIKE, ADIDAS...).
   - "CUSTOMERS": Tên khách hàng.
   - "Total Qty": Tổng số lượng sản phẩm.
   - "Article Name": Tên sản phẩm.
   - "STATUS": Các mức level xử lý (10.RECEIVED -> 9.STORED...).
   - "Delay-Urgent": Tình trạng đơn hàng (DELAY hoặc URGENT).

2. Hệ thống 'Hàng bù' (Supplement Tracking):
   - Các công đoạn chính (Section): Dán, Cắt, Molding, DC, Molded.
   - Trạng thái (Action): IN (Bắt đầu xử lý), OUT (Hoàn thành công đoạn).
   - "Đang xử lý": Có quét IN nhưng chưa quét OUT ở công đoạn đó.
   - "Hoàn thành": Đã quét OUT.

NGUYÊN TẮC QUAN TRỌNG:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN. Chỉ nói những gì thấy trong phần [DỮ LIỆU].
2. Nếu người dùng hỏi về "Molding", "Cắt", "Dán" trong bối cảnh "hàng bù", hãy xem dữ liệu Supplement.
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

            // Tra cứu thêm tiến độ hàng bù nếu có
            const { data: trackings } = await supabase.from('supplement_tracking').select('section, action, scan_date').eq('rpro', searchRpro).order('created_at', { ascending: true });
            if (trackings && trackings.length > 0) {
                dataContext += `\n[TIẾN ĐỘ HÀNG BÙ ${searchRpro}]:\n${JSON.stringify(trackings, null, 2)}`;
            }
        } else if (soMatch) {
            const searchSo = soMatch[0].toUpperCase();
            const { data: orders } = await supabase.from('powerapp').select('*').eq('SO', searchSo).limit(5);
            if (orders) dataContext += `\n\n[DANH SÁCH THEO SO ${searchSo}]:\n${JSON.stringify(orders, null, 2)}`;
        }

        // 4. TRA CỨU TIẾN ĐỘ HÀNG BÙ (Nếu hỏi về Molding, Cắt, Dán...)
        const supplementKeywords = ["bù", "supplement", "tiến độ", "molding", "cắt", "dán", "dc", "molded"];
        if (supplementKeywords.some(k => queryLower.includes(k))) {
            const { data: recentTrackings } = await supabase
                .from('supplement_tracking')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (recentTrackings) {
                // Thống kê sơ bộ tiến độ cho AI
                const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
                const stats = {};
                sections.forEach(s => stats[s] = { in: 0, out: 0 });

                const rproMap = {};
                recentTrackings.forEach(t => {
                    if (!rproMap[t.rpro]) rproMap[t.rpro] = {};
                    if (!rproMap[t.rpro][t.section]) rproMap[t.rpro][t.section] = {};
                    rproMap[t.rpro][t.section][t.action] = true;
                });

                const rproDetails = {};
                sections.forEach(s => rproDetails[s] = { inProgress: [], completed: [] });

                Object.keys(rproMap).forEach(r => {
                    sections.forEach(s => {
                        if (rproMap[r][s]?.IN && !rproMap[r][s]?.OUT) {
                            stats[s].in++;
                            rproDetails[s].inProgress.push(r);
                        }
                        if (rproMap[r][s]?.OUT) {
                            stats[s].out++;
                            rproDetails[s].completed.push(r);
                        }
                    });
                });

                dataContext += `\n[THỐNG KÊ CHI TIẾT HÀNG BÙ (100 lệnh quét gần nhất)]:`;
                sections.forEach(s => {
                    dataContext += `\n- CÔNG ĐOẠN ${s.toUpperCase()}:
  + Đang xử lý (${stats[s].in} đơn): ${stats[s].in > 0 ? rproDetails[s].inProgress.join(', ') : 'Không có'}
  + Đã xong (${stats[s].out} đơn): ${stats[s].out > 0 ? rproDetails[s].completed.join(', ') : 'Không có'}`;
                });
                dataContext += `\n`;
            }
        }

    } catch (dbErr) {
        console.warn("⚠️ Lỗi database:", dbErr.message);
    }

    const candidateModels = [
        "gemini-1.5-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-2.0-flash"
    ];

    console.log(`🤖 Đang xử lý câu hỏi: "${prompt.substring(0, 50)}..."`);

    for (const modelName of candidateModels) {
        try {
            console.log(`   Trying model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU HỆ THỐNG]:\n${dataContext}\n\n[CÂU HỎI]: ${prompt}`;

            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            const text = response.text();

            if (text) {
                console.log(`   ✅ Success with ${modelName}`);
                return text;
            }
        } catch (err) {
            console.warn(`   ❌ Model ${modelName} failed: ${err.message}`);
            // Check for quota or key issues
            if (err.message.includes("API_KEY_INVALID") || err.message.includes("API key not found")) {
                return "🤖 [Hệ thống]: Lỗi xác thực API Key. Vui lòng kiểm tra lại GEMINI_API_KEY trong file ai-core.js.";
            }
            if (err.message.includes("429") || err.message.includes("quota")) {
                console.warn("   ⚠️ Quota exceeded for this model.");
            }

            if (modelName === candidateModels[candidateModels.length - 1]) {
                console.warn("   ‼️ All Gemini models failed. Switching to Hugging Face (Qwen 2.5)...");

                try {
                    const hfResponse = await fetch(MODEL_URL, {
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

                    const hfData = await hfResponse.json();
                    if (hfData.error) throw new Error(hfData.error.message || JSON.stringify(hfData.error));

                    if (hfData.choices && hfData.choices[0] && hfData.choices[0].message) {
                        console.log("   ✅ Success with Hugging Face (Qwen 2.5)");
                        return hfData.choices[0].message.content;
                    }
                } catch (hfErr) {
                    console.error("   ‼️ Hugging Face also failed:", hfErr.message);
                    return "🤖 [Hệ thống]: Không kết nối được bộ não AI (Gemini & Qwen đều quá tải). Vui lòng thử lại sau giây lát.";
                }
            }
        }
    }
}
