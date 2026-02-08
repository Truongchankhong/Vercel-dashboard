
import fetch from 'node-fetch';

const GEMINI_API_KEY = "AIzaSyAmZxLaoIh_Ff3nmnzo4iL_lL04js1irec";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, context } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

        if (data.error) {
            console.error("Gemini Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ error: 'AI không trả về kết quả' });
        }

        const aiResponse = data.candidates[0].content.parts[0].text;
        res.status(200).json({ response: aiResponse });

    } catch (err) {
        console.error('❌ [CHAT API ERROR]:', err);
        res.status(500).json({ error: 'Lỗi hệ thống AI: ' + err.message });
    }
}
