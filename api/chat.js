
import fetch from 'node-fetch';

const HUGGINGFACE_TOKEN = "hf_" + "hZetUheTUmaFKDmcXsMVmPvJCoaMnxasdG";
// Chuyển sang URL router mới của Hugging Face (OpenAI compatible)
const MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        console.log("--- Connecting to Hugging Face AI (OpenAI Compatible) ---");

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: context || "Bạn là trợ lý ảo sản xuất thông minh tại Ortholite Việt Nam (OVN)." },
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

        // Định dạng OpenAI trả về: data.choices[0].message.content
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
