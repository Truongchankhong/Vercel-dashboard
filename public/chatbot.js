
/**
 * AI PRODUCTION ASSISTANT - ORTHOLITE VIETNAM
 * Tích hợp trí tuệ nhân tạo vào Dashboard sản xuất
 */

const SYSTEM_PROMPT = `Bạn là trợ lý ảo sản xuất thông minh tại Ortholite Việt Nam (OVN). 
Nhiệm vụ của bạn là:
1. Hỗ trợ người dùng tra cứu tiến độ sản xuất (đặc biệt là hàng bù).
2. Phân tích dữ liệu và cảnh báo các đơn hàng bị chậm.
3. Giải thích các thuật ngữ sản xuất (Dán, Cắt, Molding, Leanline DC/Molded).
4. Phản hồi lịch sự, chuyên nghiệp bằng tiếng Việt.
Hãy ghi nhớ: Bạn đang hỗ trợ đội ngũ sản xuất để tối ưu hóa quy trình. Hãy tập trung vào dữ liệu và giải pháp.`;

class AIChatbot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
        this.init();
    }

    init() {
        this.injectStyles();
        this.render();
        this.addEventListeners();
        this.addWelcomeMessage();
    }

    injectStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './chatbot.css';
        document.head.appendChild(link);
    }

    render() {
        const container = document.createElement('div');
        container.id = 'ai-chatbot-container';
        container.innerHTML = `
            <div id="ai-chatbot-button">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
            </div>
            <div id="ai-chatbot-window">
                <div class="chatbot-header">
                    <div>
                        <h3>🤖 OVN AI Assistant</h3>
                        <span style="font-size: 10px; opacity: 0.8;">Powered by Gemini AI</span>
                    </div>
                    <button id="chatbot-config-btn" style="background:none; border:none; color:white; cursor:pointer;">
                        <svg style="width:20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </button>
                </div>
                <div class="chatbot-messages" id="chatbot-messages"></div>
                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" placeholder="Hỏi tôi về tiến độ sản xuất...">
                    <button id="chatbot-send-btn">
                        <svg style="width:20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </button>
                </div>
                <!-- Config Modal Inner -->
                <div id="ai-config-modal">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px;">Cấu hình AI (Gemini API Key)</h4>
                    <p style="font-size: 11px; color: #666; margin-bottom: 15px;">Bạn cần API Key để AI có thể hoạt động thực tế. Lấy miễn phí tại: <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a></p>
                    <input type="password" id="api-key-input" placeholder="Nhập API Key của bạn..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #ddd; margin-bottom:15px; font-size:12px;">
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button id="save-api-key" style="background:#3b82f6; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:bold;">Lưu</button>
                        <button id="close-config" style="background:#eee; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-size:12px;">Đóng</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    addEventListeners() {
        const btn = document.getElementById('ai-chatbot-button');
        const window = document.getElementById('ai-chatbot-window');
        const input = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('chatbot-send-btn');
        const configBtn = document.getElementById('chatbot-config-btn');
        const configModal = document.getElementById('ai-config-modal');
        const saveApiKey = document.getElementById('save-api-key');
        const apiKeyInput = document.getElementById('api-key-input');
        const closeConfig = document.getElementById('close-config');

        btn.onclick = () => {
            this.isOpen = !this.isOpen;
            window.classList.toggle('active', this.isOpen);
            if (this.isOpen) input.focus();
        };

        configBtn.onclick = (e) => {
            e.stopPropagation();
            configModal.classList.add('active');
            apiKeyInput.value = this.apiKey;
        };

        closeConfig.onclick = () => configModal.classList.remove('active');

        saveApiKey.onclick = () => {
            this.apiKey = apiKeyInput.value.trim();
            localStorage.setItem('gemini_api_key', this.apiKey);
            configModal.classList.remove('active');
            this.addMessage('ai', '✅ Đã cập nhật API Key thành công!');
        };

        sendBtn.onclick = () => this.handleSendMessage();
        input.onkeypress = (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        };
    }

    async handleSendMessage() {
        const input = document.getElementById('chatbot-input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage('user', text);
        input.value = '';

        if (!this.apiKey) {
            this.addMessage('ai', 'Vui lòng nhấn vào biểu tượng bánh răng ở góc trên để nhập **Gemini API Key** trước khi bắt đầu. Bạn có thể lấy key miễn phí từ Google AI Studio.');
            return;
        }

        // Show typing indicator
        const typingId = this.addTypingIndicator();

        try {
            const response = await this.callGeminiAPI(text);
            this.removeTypingIndicator(typingId);
            this.addMessage('ai', response);
        } catch (err) {
            this.removeTypingIndicator(typingId);
            this.addMessage('ai', '❌ Rất tiếc, đã có lỗi xảy ra khi kết nối với AI. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.');
            console.error(err);
        }
    }

    async callGeminiAPI(prompt) {
        // Collect context data from the page if available
        let contextData = "";
        try {
            // Check if there's table data available on the page
            const rows = document.querySelectorAll('#progress-table-body tr');
            if (rows.length > 0) {
                const dataSummary = Array.from(rows).slice(0, 10).map(row => {
                    const rpro = row.querySelector('td:first-child')?.innerText || "Unknown";
                    return `RPRO: ${rpro}`;
                }).join(', ');
                contextData = `\nDữ liệu thực tế đang hiển thị trên trang (10 đơn đầu): ${dataSummary}`;
            }
        } catch (e) { }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${SYSTEM_PROMPT}${contextData}\n\nNgười dùng hỏi: ${prompt}` }]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.candidates[0].content.parts[0].text;
    }

    addMessage(type, text) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;

        // Simple markdown replacement for bold and line breaks
        const formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');

        msgDiv.innerHTML = formattedText;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return msgDiv;
    }

    addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const messagesContainer = document.getElementById('chatbot-messages');
        const div = document.createElement('div');
        div.id = id;
        div.className = 'message ai typing';
        div.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    addWelcomeMessage() {
        setTimeout(() => {
            this.addMessage('ai', 'Chào bạn! Tôi là trợ lý AI của OVN. Tôi có thể giúp gì cho bạn trong việc theo dõi tiến độ sản xuất hôm nay?');
        }, 500);
    }
}

// Khởi tạo Chatbot khi trang tải xong
window.addEventListener('DOMContentLoaded', () => {
    window.ovnChatbot = new AIChatbot();
});
