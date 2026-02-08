
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

        // --- 2. THỐNG KÊ CHI TIẾT (PRODUCTION INSIGHTS) ---
        const queryLower = prompt.toLowerCase();
        const generalKeywords = ["tổng cộng", "tình hình", "báo cáo", "delay", "chậm", "bao nhiêu", "thế nào", "gấp"];

        if (generalKeywords.some(k => queryLower.includes(k))) {
            try {
                // Lấy snapshot dữ liệu (Tổng hợp nhanh)
                const { data: allStats } = await supabase.from('powerapp').select('Brand Code, STATUS, Delay-Urgent, Total Qty');

                if (allStats && allStats.length > 0) {
                    const totalOrders = allStats.length;
                    const delayOrders = allStats.filter(o => o['Delay-Urgent'] === 'PRODUCTION DELAY').length;
                    const urgentOrders = allStats.filter(o => o['Delay-Urgent'] === 'URGENT').length;

                    // Thống kê theo Brand
                    const brandStats = {};
                    allStats.forEach(o => {
                        const b = o['Brand Code'] || 'Khác';
                        brandStats[b] = (brandStats[b] || 0) + 1;
                    });
                    const topBrands = Object.entries(brandStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => `${e[0]}: ${e[1]} đơn`).join(', ');

                    // Thống kê theo Status
                    const statusStats = {};
                    allStats.forEach(o => {
                        const s = o['STATUS'] || 'Unknown';
                        statusStats[s] = (statusStats[s] || 0) + 1;
                    });

                    finalContext += `\n\n[BÁO CÁO NHANH HỆ THỐNG]:
- Tổng đơn hàng: ${totalOrders}
- Đang bị Delay: ${delayOrders}
- Đơn hàng Gấp: ${urgentOrders}
- Top 3 Thương hiệu: ${topBrands}
- Trạng thái hiện tại: ${JSON.stringify(statusStats)}`;

                    finalContext += `\nNhiệm vụ: Bạn hãy đóng vai một "Chuyên gia điều phối sản xuất", phân tích các con số trên để báo cáo tình hình. Đừng chỉ đọc số lớn, hãy tìm ra điểm bất thường (Ví dụ: Brand nào đang bị delay nhiều nhất).`;
                }
            } catch (err) { console.error("Snapshot Err:", err); }
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
                    { role: "system", content: finalContext },
                    { role: "user", content: prompt }
                ],
                max_tokens: 1024,
                temperature: 0.7,
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
