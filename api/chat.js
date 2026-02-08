
import fetch from 'node-fetch';

const GEMINI_API_KEY = "AIzaSyAmZxLaoIh_Ff3nmnzo4iL_lL04js1irec";

// Danh sách các mô hình có khả năng hỗ trợ để thử nghiệm theo thứ tự ưu tiên
const MODELS = [
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash"
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    let lastError = null;

    // Thử lần lượt các mô hình cho đến khi thành công
    for (const modelName of MODELS) {
        try {
            console.log(`--- Thử kết nối với mô hình: ${modelName} ---`);

            // Thử cả v1 và v1beta nếu cần, nhưng v1beta thường bao quát hơn
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${context || ''}\n\nNgười dùng hỏi: ${prompt}` }]
                    }]
                })
            });

            const data = await response.json();

            // Nếu thành công (không có lỗi và có dữ liệu trả về)
            if (!data.error && data.candidates && data.candidates.length > 0) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                return res.status(200).json({
                    response: aiResponse,
                    model_active: modelName
                });
            }

            // Nếu lỗi do hết hạn mức (Quota), ta báo luôn cho người dùng
            if (data.error && data.error.message.includes("quota")) {
                return res.status(429).json({ error: "⚠️ Tài khoản AI đã hết hạn mức miễn phí hôm nay. Vui lòng quay lại sau." });
            }

            // Nếu lỗi khác (như Not Found), tiếp tục thử mô hình tiếp theo
            console.warn(`Mô hình ${modelName} không phản hồi:`, data.error ? data.error.message : "Dữ liệu trống");
            lastError = data.error ? data.error.message : "Model not found or unsupported";

        } catch (err) {
            console.error(`Lỗi kết nối ${modelName}:`, err.message);
            lastError = err.message;
        }
    }

    // Nếu đã thử hết các mô hình mà vẫn thất bại
    res.status(500).json({
        error: `❌ Không thể kết nối với bất kỳ dòng AI nào (Lỗi cuối: ${lastError}). Vui lòng kiểm tra lại trạng thái API Key.`
    });
}
