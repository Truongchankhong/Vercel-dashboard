
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
                        <span style="font-size: 10px; opacity: 0.8;">Hệ thống hỗ trợ sản xuất thông minh</span>
                    </div>
                </div>
                <div class="chatbot-messages" id="chatbot-messages"></div>
                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" placeholder="Hỏi tôi về tiến độ sản xuất...">
                    <button id="chatbot-send-btn">
                        <svg style="width:20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </button>
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

        btn.onclick = () => {
            this.isOpen = !this.isOpen;
            window.classList.toggle('active', this.isOpen);
            if (this.isOpen) input.focus();
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

        // Show typing indicator
        const typingId = this.addTypingIndicator();

        try {
            // Get context data from the page
            let contextData = SYSTEM_PROMPT;
            try {
                const rows = document.querySelectorAll('#progress-table-body tr');
                if (rows.length > 0) {
                    const dataSummary = Array.from(rows).slice(0, 15).map(row => {
                        const rpro = row.querySelector('td:first-child')?.innerText || "Unknown";
                        // Get status from each cell if possible (optional enhancement)
                        return `RPRO: ${rpro}`;
                    }).join(', ');
                    contextData += `\n\nDữ liệu thực tế trên trang (15 đơn đầu): ${dataSummary}`;
                }
            } catch (e) { }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    context: contextData
                })
            });

            const data = await response.json();
            this.removeTypingIndicator(typingId);

            if (data.error) throw new Error(data.error);
            this.addMessage('ai', data.response);

        } catch (err) {
            this.removeTypingIndicator(typingId);
            this.addMessage('ai', '❌ Không thể kết nối với trung tâm AI. Vui lòng liên hệ IT hoặc thử lại sau.');
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
