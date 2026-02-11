
import { generateAIResponse } from './ai-core.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await generateAIResponse(prompt);
        return res.status(200).json({ response });
    } catch (err) {
        console.error("API Handler Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
}
