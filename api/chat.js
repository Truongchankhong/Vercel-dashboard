
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const HUGGINGFACE_TOKEN = "hf_" + "oclaBATrCCZUVRcEvBiGPFNCSHWOyfpGhu";
const MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct";

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        console.log("--- Connecting to Hugging Face AI & Supabase ---");

        let finalContext = context || "Bạn là trợ lý ảo sản xuất thông minh tại Ortholite Việt Nam (OVN).";

        // --- 1. TÌM KIẾM CHI TIẾT THEO RPRO ---
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            try {
                const { data: orderDetail } = await supabase
                    .from('powerapp')
                    .select('*')
                    .eq('PRO ODER', searchRpro)
                    .maybeSingle();

                if (orderDetail) {
                    finalContext += `\n\n[DỮ LIỆU THỰC TẾ SUPABASE]:\nĐơn hàng ${searchRpro} có thông tin:\n${JSON.stringify(orderDetail, null, 2)}`;
                    finalContext += `\nBẠN PHẢI TRẢ LỜI dựa trên dữ liệu này.`;
                }
            } catch (err) { console.error("RPRO Search Err:", err); }
        }

        // --- 2. THỐNG KÊ CHI TIẾT & LẬP KẾ HOẠCH (PLANNING INSIGHTS) ---
        const queryLower = prompt.toLowerCase();
        const planningKeywords = ["kế hoạch", "ưu tiên", "tư vấn", "chạy đơn", "sắp xếp", "lịch", "nên làm"];
        const generalKeywords = ["tổng", "lượng", "bao nhiêu", "tình hình", "báo cáo", "delay", "chậm", "trễ", "gấp"];

        if (planningKeywords.some(k => queryLower.includes(k)) || generalKeywords.some(k => queryLower.includes(k))) {
            try {
                // --- 2A. PHÁT HIỆN BRAND CỤ THỂ TRONG CÂU HỎI ---
                const knownBrands = ["ASICS", "NIKE", "BROOKS", "ON RUNNING", "PUMA", "ADIDAS", "NEW BALANCE"];
                const detectedBrand = knownBrands.find(b => queryLower.includes(b.toLowerCase()));

                if (detectedBrand) {
                    console.log(`Detected brand: ${detectedBrand} - Fetching stats...`);
                    const { data: brandData } = await supabase
                        .from('powerapp')
                        .select('Total Qty, Delay-Urgent')
                        .ilike('Brand Code', `%${detectedBrand}%`);

                    if (brandData && brandData.length > 0) {
                        const brandDelayQty = brandData
                            .filter(o => (o['Delay-Urgent'] || '').toString().toLowerCase().includes('delay'))
                            .reduce((sum, o) => {
                                const val = String(o['Total Qty'] || '0').replace(/,/g, '');
                                return sum + (parseFloat(val) || 0);
                            }, 0);

                        const brandTotalQty = brandData.reduce((sum, o) => {
                            const val = String(o['Total Qty'] || '0').replace(/,/g, '');
                            return sum + (parseFloat(val) || 0);
                        }, 0);

                        finalContext += `\n\n[DỮ LIỆU HỆ THỐNG XÁC THỰC - BRAND ${detectedBrand}]:
- TỔNG SỐ LƯỢNG của thương hiệu ${detectedBrand}: ${brandTotalQty.toLocaleString()} đôi.
- SỐ LƯỢNG ĐANG CHẬM (DELAY): ${brandDelayQty.toLocaleString()} đôi.
- Số lượng GẤP (Urgent): ${brandData.filter(o => (o['Delay-Urgent'] || '').toString().toLowerCase().includes('urgent')).reduce((sum, o) => sum + (parseFloat(o['Total Qty']) || 0), 0).toLocaleString()} đôi.

CHỈ THỊ QUAN TRỌNG: Bạn hãy dùng con số ${brandDelayQty.toLocaleString()} để trả lời về lượng hàng delay của ${detectedBrand}. TUYỆT ĐỐI KHÔNG nói là "cần truy cập hệ thống" hay "viết code SQL". Hãy trả lời: "Dựa vào dữ liệu từ hệ thống, thương hiệu ${detectedBrand} đang có ${brandDelayQty.toLocaleString()} đôi bị delay..."`;
                    }
                }

                // --- 2C. THỐNG KÊ SCAN HÀNG BÙ HÔM NAY ---
                const scanKeywords = ["scan", "đếm", "hàng bù", "thống kê hôm nay", "tiến độ"];
                if (scanKeywords.some(k => queryLower.includes(k))) {
                    console.log("Detecting scan-related query, fetching supplement_tracking...");
                    const today = new Date().toISOString().split('T')[0];
                    const { data: scanData } = await supabase
                        .from('supplement_tracking')
                        .select('section, rpro, action')
                        .gte('scan_date', today);

                    if (scanData && scanData.length > 0) {
                        const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
                        let scanSummary = "\n\n[DỮ LIỆU SCAN HÀNG BÙ HÔM NAY]:";
                        sections.forEach(s => {
                            const sectionRows = scanData.filter(r => r.section === s);
                            const totalScans = sectionRows.length;
                            const distinctOrders = new Set(sectionRows.map(r => r.rpro)).size;
                            if (totalScans > 0) {
                                scanSummary += `\n- Bộ phận ${s}: ${distinctOrders} đơn (Tổng ${totalScans} lượt quét IN/OUT)`;
                            }
                        });
                        finalContext += scanSummary;
                        finalContext += `\nLƯU Ý: Số lượng đơn (RPRO) được tính bằng cách đếm các mã đơn khác nhau (Distinct), còn tổng lượt quét bao gồm cả Nhập (IN) và Xuất (OUT). Bạn nên ưu tiên dùng số lượng đơn để báo cáo. Sau khi liệt kê xong, nếu người dùng muốn biết đơn cụ thể nào thì hãy nói họ xem trang Tổng Hợp.`;
                    } else {
                        finalContext += "\n\n[DỮ LIỆU HỆ THỐNG]: Hôm nay chưa có dữ liệu scan hàng bù nào được ghi nhận.";
                    }
                }

                // --- 2D. LẤY SNAPSHOT TỔNG QUÁT ---
                const { data: allStats } = await supabase.from('powerapp').select('Brand Code, STATUS, Delay-Urgent, Total Qty, Finish date, PRO ODER, CUSTOMERS').limit(400);

                if (allStats && allStats.length > 0) {
                    // --- THỐNG KÊ NHANH ---
                    const totalOrders = allStats.length;
                    const delayOrders = allStats.filter(o => o['Delay-Urgent'] === 'PRODUCTION DELAY').length;
                    const urgentOrders = allStats.filter(o => o['Delay-Urgent'] === 'URGENT').length;

                    // --- LẬP KẾ HOẠCH ƯU TIÊN (Priority Planning) ---
                    // Lọc đơn chưa nhập kho, ưu tiên Urgent và Finish date sớm
                    const priorityList = allStats
                        .filter(o => o['STATUS'] !== '9.STORED' && o['STATUS'] !== '8.DELIVERY')
                        .sort((a, b) => {
                            // Ưu tiên Gấp (URGENT)
                            if (a['Delay-Urgent'] === 'URGENT' && b['Delay-Urgent'] !== 'URGENT') return -1;
                            if (a['Delay-Urgent'] !== 'URGENT' && b['Delay-Urgent'] === 'URGENT') return 1;
                            // Sau đó ưu tiên Finish date (Càng nhỏ/càng sớm càng ưu tiên)
                            return (new Date(a['Finish date']).getTime() || Infinity) - (new Date(b['Finish date']).getTime() || Infinity);
                        })
                        .slice(0, 20); // Lấy 20 đơn quan trọng nhất

                    finalContext += `\n\n[BÁO CÁO NHANH]: Tổng ${totalOrders} đơn, ${delayOrders} delay, ${urgentOrders} gấp.`;

                    finalContext += `\n\n[DANH SÁCH ĐƠN HÀNG CẦN ƯU TIÊN (TOP 20)]:`;
                    priorityList.forEach((o, i) => {
                        finalContext += `\n${i + 1}. ${o['PRO ODER']} | KH: ${o['CUSTOMERS']} | Hạn: ${o['Finish date']} | Trạng thái: ${o['STATUS']} | Loại: ${o['Delay-Urgent']}`;
                    });

                    finalContext += `\n\nNHIỆM VỤ CỦA BẠN:
1. Bạn là chuyên gia Lập kế hoạch sản xuất (Production Planner).
2. Dựa vào danh sách Top 20 trên, hãy tư vấn cho người dùng nên tập trung chạy đơn nào trước.
3. Giải thích lý do (Ví dụ: Vì đơn này gấp hoặc sắp quá hạn Finish date).
4. Nếu thấy nhiều đơn kẹt ở một bước (STATUS), hãy đưa ra cảnh báo về điểm nghẽn dây chuyền.`;
                }
            } catch (err) { console.error("Planning Err:", err); }
        }

        // --- 3. GỬI ĐẾN AI (HUGGING FACE) ---
        // Kỹ thuật "Cưỡng chế thông minh": Đưa dữ liệu thẳng vào câu hỏi của người dùng
        let aiFormattedPrompt = prompt;
        if (finalContext.includes("[DỮ LIỆU")) {
            aiFormattedPrompt = `DƯỚI ĐÂY LÀ DỮ LIỆU THỰC TẾ TỪ HỆ THỐNG SUPABASE (BẮT BUỘC SỬ DỤNG):\n${finalContext}\n\n----------\nCÂU HỎI CỦA NGƯỜI DÙNG: ${prompt}`;
        }

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: "Bạn là chuyên gia điều phối sản xuất OVN. Bạn phải dùng dữ liệu được cung cấp để trả lời ngay lập tức. TUYỆT ĐỐI KHÔNG giải thích cách tra cứu hay SQL." },
                    { role: "user", content: aiFormattedPrompt }
                ],
                max_tokens: 1024,
                temperature: 0.1, // Giảm độ sáng tạo để ưu tiên độ chính xác
                stream: false
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("HF Error:", data.error);
            if (typeof data.error === 'string' && data.error.includes("loading")) {
                return res.status(503).json({ error: "AI đang được khởi động (khoảng 1 phút). Vui lòng thử lại sau giây lát." });
            }
            return res.status(500).json({ error: "Lỗi AI: " + (data.error.message || JSON.stringify(data.error)) });
        }

        if (data.choices && data.choices.length > 0) {
            const aiResponse = data.choices[0].message.content;
            return res.status(200).json({
                response: aiResponse,
                model_active: MODEL_ID
            });
        }

        throw new Error("Không nhận được phản hồi định dạng chuẩn từ AI");

    } catch (err) {
        console.error('❌ [CHAT API ERROR]:', err);
        res.status(500).json({ error: 'Lỗi hệ thống AI: ' + err.message });
    }
}
