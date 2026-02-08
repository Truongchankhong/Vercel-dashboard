
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

        // --- TÌM KIẾM DỮ LIỆU ĐƠN HÀNG TRÊN SUPABASE ---
        const rproMatch = prompt.match(/RPRO-[\d-]+/i);
        if (rproMatch) {
            const searchRpro = rproMatch[0].toUpperCase();
            try {
                // Ưu tiên tìm trong bảng powerapp trên Supabase
                const { data: orderDetail, error } = await supabase
                    .from('powerapp')
                    .select('*')
                    .eq('PRO ODER', searchRpro)
                    .maybeSingle();

                if (orderDetail) {
                    finalContext += `\n\n[DỮ LIỆU THỰC TẾ SUPABASE - QUAN TRỌNG]:\nĐơn hàng ${searchRpro} có thông tin sau:\n${JSON.stringify(orderDetail, null, 2)}`;
                    finalContext += `\nBẠN PHẢI TRẢ LỜI: "Dựa vào dữ liệu hệ thống Supabase, đơn hàng ${searchRpro}..." và trích dẫn thông tin chi tiết.`;
                } else {
                    finalContext += `\n\n[THÔNG BÁO]: Không tìm thấy đơn hàng ${searchRpro} trong bảng powerapp trên Supabase. Hãy báo cho người dùng biết mã này không tồn tại trên hệ thống.`;
                }
            } catch (err) {
                console.error("Supabase Search Error:", err);
            }
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
