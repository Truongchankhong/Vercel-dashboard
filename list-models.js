import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyBdfvhY3nU2Ung11JBlErZLiwC0J2i4kNM";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function run() {
    try {
        const models = [];
        // The SDK doesn't have a direct listModels on genAI in all versions, 
        // but we can try to fetch the models list via the REST endpoint directly to be 100% sure.
        console.log("--- KIỂM TRA QUYỀN TRUY CẬP MODEL ---");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ Lỗi API:", data.error.message);
            return;
        }

        console.log("✅ Các model bạn có quyền sử dụng:");
        data.models.forEach(m => {
            console.log(`- ${m.name.replace('models/', '')} (${m.supportedGenerationMethods.join(', ')})`);
        });

    } catch (err) {
        console.error("❌ Lỗi kết nối:", err.message);
    }
}

run();
