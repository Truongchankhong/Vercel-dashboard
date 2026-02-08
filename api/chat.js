
import fetch from 'node-fetch';
const HUGGINGFACE_TOKEN = "hf_" + "hZetUheTUmaFKDmcXsMVmPvJCoaMnxasdG";
// Sử dụng mô hình Qwen 2.5 72B Instruct - Cực mạnh về tiếng Việt và phân tích dữ liệu
const MODEL_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        console.log("--- Connecting to Hugging Face AI (Qwen 2.5) ---");

        const fullPrompt = `<|im_start|>system\n${context || 'Bạn là trợ lý ảo sản xuất thông minh tại Ortholite Việt Nam (OVN).'}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                parameters: {
                    max_new_tokens: 1024,
                    temperature: 0.7,
                    return_full_text: false
                }
            })
        });

        const data = await response.json();

        // Kiểm tra lỗi từ Hugging Face
        if (data.error) {
            console.error("HF Error:", data.error);
            // Một số mẫu lỗi: "Model is loading", 503 Service Unavailable
            if (data.error.includes("loading")) {
                return res.status(503).json({ error: "AI đang được khởi động (khoảng 1 phút). Vui lòng thử lại sau giây lát." });
            }
            return res.status(500).json({ error: "Lỗi AI: " + data.error });
        }

        // Dữ liệu từ HF thường là mảng [{ generated_text: "..." }]
        let aiResponse = "";
        if (Array.isArray(data) && data[0].generated_text) {
            aiResponse = data[0].generated_text;
        } else if (data.generated_text) {
            aiResponse = data.generated_text;
        } else {
            console.warn("Unexpected HF Data Format:", data);
            throw new Error("Không nhận được phản hồi từ AI");
        }

        // Làm sạch phản hồi nếu cần (bỏ các tag thừa của Qwen)
        aiResponse = aiResponse.split("<|im_end|>")[0].split("<|im_start|>")[0].trim();

        res.status(200).json({
            response: aiResponse,
            model_active: "Qwen-2.5-72B"
        });

    } catch (err) {
        console.error('❌ [CHAT API ERROR]:', err);
        res.status(500).json({ error: 'Lỗi hệ thống AI: ' + err.message });
    }
}
