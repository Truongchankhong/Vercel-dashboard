
import puppeteer from 'puppeteer';
import { generateAIResponse } from './api/ai-core.js';

// --- CONFIGURATION ---
const GROUP_NAME_KEYWORD = "AI Assistant"; // Tên nhóm Zalo cần theo dõi
const BOT_TRIGGER = "@AI"; // Từ khóa để gọi Bot
const CHECK_INTERVAL = 3000; // Kiểm tra tin nhắn mỗi 3 giây

async function startZaloBot() {
    console.log("🚀 Đang khởi động Zalo AI Bot...");

    // 1. Launch Browser
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--disable-notifications',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    });

    const page = await browser.newPage();

    // 2. Go to Zalo Web
    console.log("globe: Đang mở Zalo Web (https://chat.zalo.me)...");
    await page.goto('https://chat.zalo.me', { waitUntil: 'networkidle2' });

    console.log("⚠️  VUI LÒNG QUÉT MÃ QR HOẶC ĐĂNG NHẬP TRONG VÒNG 90 GIÂY!");

    // Wait for login by checking for key elements that only appear after login
    try {
        await page.waitForFunction(
            () => document.querySelector('#main-tab') || document.querySelector('.left-menu') || document.querySelector('.zalo-avatar') || document.querySelector('#contact-search-input'),
            { timeout: 90000 }
        );
        console.log("✅ Đã phát hiện giao diện chính (Đăng nhập thành công)!");
    } catch (e) {
        console.log("❌ Hết 90s mà chưa thấy giao diện chính. Vui lòng thử lại.");
        await browser.close();
        return;
    }

    // 3. Find and Select the Target Group
    console.log(`🔍 Đang tìm nhóm "${GROUP_NAME_KEYWORD}"...`);

    // Give Zalo Web significant time to fully load the contact list and event listeners
    await new Promise(r => setTimeout(r, 5000));

    try {
        const searchSelectors = [
            '#contact-search-input',
            'input[placeholder="Tìm kiếm"]',
            'input[placeholder="Search"]',
            '.global-search-box input'
        ];

        let searchInput = null;
        for (const selector of searchSelectors) {
            try {
                // Short timeout for each attempt
                await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                searchInput = selector;
                console.log(`✅ Tìm thấy thanh tìm kiếm với selector: ${selector}`);
                break;
            } catch (e) {
                // Ignore and try next
            }
        }

        if (searchInput) {
            await page.click(searchInput);
            // Clear existing text just in case
            await page.evaluate((sel) => document.querySelector(sel).value = '', searchInput);
            await page.type(searchInput, GROUP_NAME_KEYWORD, { delay: 150 });
        } else {
            console.warn("⚠️ Không tìm thấy thanh tìm kiếm bằng selector. Đang thử phím tắt Ctrl+F...");
            // Fallback: Try Zalo shortcut for search (Ctrl+F is common, but Zalo technically puts focus on search often)
            // Or just try typing blind if focus is already there (rare)
            // Let's try to simulate a click on the general area coordinates if we could, 
            // but for now let's just try to focus the body and press Ctrl+F check.
            await page.keyboard.down('Control');
            await page.keyboard.press('F');
            await page.keyboard.up('Control');
            await new Promise(r => setTimeout(r, 1000));
            // Type anyway
            await page.keyboard.type(GROUP_NAME_KEYWORD, { delay: 150 });
        }

        console.log("⌨️  Đã nhập từ khóa tìm kiếm.");

        // Wait for search results to appear
        await new Promise(r => setTimeout(r, 3000));

        // Press Enter to select the first result
        await page.keyboard.press('Enter');
        console.log("↵  Đã nhấn Enter.");

        // Verify if we successfully entered the chat
        try {
            // Wait for main chat input or message list
            await page.waitForFunction(
                () => document.querySelector('#input_line_0') || document.querySelector('.card--text'),
                { timeout: 10000 }
            );
            console.log(`✅ Đã vào giao diện chat. Bắt đầu theo dõi...`);
        } catch (err) {
            console.warn("⚠️  Không chắc đã vào được nhóm. Hãy kiểm tra màn hình browser.");
        }

    } catch (e) {
        console.error("❌ Lỗi trong bước tìm nhóm:", e.message);
        // Continue anyway to see if monitoring works if user manually helps
    }

    // 4. Monitoring Loop
    let lastMessageContent = "";
    console.log("👀 Đang theo dõi tin nhắn mới...");

    // Default triggers (will be updated from config)
    let currentTriggers = ["@AI", "/ai", "bot", "@Xuân Trường", "Trường ơi"];
    let lastConfigCheck = 0;

    while (true) {
        // --- RELOAD CONFIG (LIVE UPDATE) ---
        const now = Date.now();
        if (now - lastConfigCheck > 5000) {
            lastConfigCheck = now;
            try {
                const fs = await import('fs/promises');
                // Sử dụng đường dẫn tuyệt đối hoặc quét thư mục hiện tại kỹ hơn
                const configPaths = ['./bot-config.json', '../bot-config.json'];
                let configFile = null;

                for (const path of configPaths) {
                    try {
                        configFile = await fs.default.readFile(path, 'utf8');
                        if (configFile) break;
                    } catch (e) { }
                }

                if (configFile) {
                    const config = JSON.parse(configFile);
                    if (config.triggers && Array.isArray(config.triggers)) {
                        currentTriggers = config.triggers;
                    }
                }
            } catch (err) { /* Keep current if fails */ }
        }

        try {
            // --- SAFETY CHECK: Verify we are in the correct group ---
            // Zalo header title selectors (may change, need multiple fallbacks)
            const headerTitleEl = await page.evaluate(() => {
                const selectors = ['header .header-title', '.title-header', '.header-info h1', '.header-info .title', '#header-title', '.chat-info-header .text'];
                for (const s of selectors) {
                    const el = document.querySelector(s);
                    if (el) return el.textContent;
                }
                return "";
            });

            // Nếu tiêu đề KHÔNG chứa tên nhóm cần theo dõi -> BỎ QUA (Safety Mode)
            // Chuẩn hóa chuỗi để so sánh (Trim + lowercase + collapse spaces)
            const cleanHeader = headerTitleEl ? headerTitleEl.trim().replace(/\s+/g, ' ').toLowerCase() : "";
            const cleanKeyword = GROUP_NAME_KEYWORD.trim().replace(/\s+/g, ' ').toLowerCase();

            if (cleanHeader && !cleanHeader.includes(cleanKeyword)) {
                if (lastMessageContent !== "WRONG_GROUP") {
                    console.log(`🔒 Đang ở nhóm khác: "${headerTitleEl}" (Clean: "${cleanHeader}"). Bot tạm dừng...`);
                    console.log(`   (Yêu cầu: "${GROUP_NAME_KEYWORD}" - Clean: "${cleanKeyword}")`);
                    lastMessageContent = "WRONG_GROUP";
                }
                await new Promise(r => setTimeout(r, 2000));
                continue; // Skip this loop iteration
            } else if (lastMessageContent === "WRONG_GROUP") {
                console.log(`✅ Đã trở lại nhóm "${GROUP_NAME_KEYWORD}". Bot tiếp tục hoạt động.`);
                lastMessageContent = "";
            }

            // --- DEBUG MODE: DETECTIVE ---
            // Find the element containing "@AI ping" to learn the correct class name
            const debugInfo = await page.evaluate(() => {
                // Limit search to likely containers to avoid performance hit, but searching all divs is safer here
                const allElements = document.querySelectorAll('div, span, p');
                for (let el of allElements) {
                    if (el.textContent && el.textContent.includes('@AI ping') && el.textContent.length < 100) {
                        return {
                            found: true,
                            tag: el.tagName,
                            id: el.id,
                            className: el.className,
                            parentClass: el.parentElement ? el.parentElement.className : 'none',
                            text: el.textContent
                        };
                    }
                }
                return { found: false };
            });

            if (debugInfo.found) {
                console.log("🕵️‍♂️ [THÁM TỬ] Tìm thấy tin nhắn mẫu!");
                console.log(`   - Tag: ${debugInfo.tag}`);
                console.log(`   - Class: ${debugInfo.className}`);
                console.log(`   - Parent Class: ${debugInfo.parentClass}`);
                console.log(`   - ID: ${debugInfo.id}`);
            }

            // STRATEGY 1: Try specific known classes for message text
            // Update 2024: Zalo Web classes change frequently
            // STRATEGY 1: Try specific known classes for message text
            // Update 2024: Zalo Web classes change frequently
            // Ưu tiên các class chắc chắn là nội dung tin nhắn (Bubble chat)
            const msgSelectors = [
                '.msg-item .text',
                '.msg-item .card-text',
                '.msg-item span[data-translate-inner]',
                '.card--text .text',
                '.card-content',
                '.bubble-content .text',
                '.message-view__content .text-content',
                '.msg-content .text'
            ];

            let lastMsgEl = null;
            let textContent = "";

            // Try to find the last message element using broad search
            for (const selector of msgSelectors) {
                const elements = await page.$$(selector);
                if (elements && elements.length > 0) {
                    // Get the last one
                    const el = elements[elements.length - 1];
                    const text = await page.evaluate(e => e.innerText || e.textContent, el);

                    // Lọc rác: Bỏ qua timestamp, status system
                    if (text && text.trim().length > 0) {
                        const cleanText = text.trim();
                        const ignoreList = ["Vài giây", "Đã gửi", "Đã xem", "Chưa có tin nhắn", "Tin nhắn đã thu hồi", "Hình ảnh"];

                        // Nếu text nằm trong blacklist hoặc quá ngắn (dưới 2 ký tự) mà không phải số -> Bỏ qua
                        if (ignoreList.includes(cleanText) || (cleanText.length < 2 && isNaN(cleanText))) continue;

                        lastMsgEl = el;
                        textContent = cleanText;
                        break; // Found valid text
                    }
                }
            }

            // Backup strategy: Check generic message items if specific text selectors failed
            if (!textContent) {
                const messages = await page.$$('.msg-item, div[id^="msg-"] .content, .chat-message .content');
                if (messages.length > 0) {
                    const el = messages[messages.length - 1];
                    const text = await page.evaluate(el => el.innerText || el.textContent, el);
                    if (text) {
                        const cleanText = text.trim();
                        const ignoreList = ["Vài giây", "Đã gửi", "Đã xem", "Chưa có tin nhắn", "Tin nhắn đã thu hồi"];
                        if (!ignoreList.includes(cleanText) && cleanText.length > 1) {
                            textContent = cleanText;
                            lastMsgEl = el;
                        }
                    }
                }
            }

            if (textContent) {
                // Check if new message and NOT empty
                if (textContent && textContent !== lastMessageContent) {
                    lastMessageContent = textContent;
                    console.log(`📩 Hệ thống nhận thấy text thô: "${textContent}"`);

                    // Check triggers
                    const lowerText = textContent.toLowerCase();
                    const triggerMatch = currentTriggers.find(t => lowerText.includes(t.toLowerCase()));

                    if (triggerMatch) {
                        console.log(`🤖 Phát hiện lệnh gọi "${triggerMatch}" trong tin nhắn.`);

                        // Mark as read (optional, by clicking)
                        if (lastMsgEl) {
                            try { await lastMsgEl.click(); } catch (e) { }
                        }

                        // Generate AI response
                        // Extract Query - If trigger is not at start, we take everything after it
                        const triggerIndex = lowerText.indexOf(triggerMatch.toLowerCase());
                        const query = textContent.slice(triggerIndex + triggerMatch.length).trim();

                        if (query.length > 0) {
                            const aiReply = await generateAIResponse(textContent); // Send full context just in case
                            if (aiReply) {
                                await sendReply(page, aiReply);
                            }
                        } else {
                            // Case: "Lu lu" (empty query)
                            await sendReply(page, "Dạ em nghe? Anh/Chị cần em giúp gì không ạ?");
                        }
                    } else {
                        console.log(`   (Bỏ qua message: "${textContent}" - Không có từ khóa)`);
                    }
                }
            }
        } catch (err) {
            console.error("⚠️ Lỗi vòng lặp monitor:", err.message);
        }

        // Wait before next check
        await new Promise(r => setTimeout(r, CHECK_INTERVAL));
    }
}

async function sendReply(page, text) {
    try {
        console.log("📤 Đang chuẩn bị gửi phản hồi...");

        // Đảm bảo tab Zalo đang được active
        await page.bringToFront();

        // Danh sách các selector ô nhập liệu Zalo (đề phòng thay đổi)
        const selectors = ['#input_line_0', '.rich-input__textarea', 'div[contenteditable="true"]'];
        let inputFound = false;

        for (const selector of selectors) {
            try {
                const isVisible = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el && el.getBoundingClientRect().height > 0;
                }, selector);

                if (isVisible) {
                    // Click vào ô nhập liệu để kích hoạt (quan trọng khi ẩn cửa sổ)
                    await page.click(selector);
                    await new Promise(r => setTimeout(r, 500)); // Chờ 0.5s cho chắc

                    // Gõ tin nhắn
                    await page.keyboard.type(text, { delay: 5 });
                    await page.keyboard.press('Enter');

                    console.log(`✅ Đã gửi phản hồi qua selector: ${selector}`);
                    inputFound = true;
                    break;
                }
            } catch (e) { }
        }

        if (!inputFound) {
            console.error("❌ Không tìm thấy ô nhập liệu hoặc Zalo bị khóa màn hình.");
            // Fallback: Thử gõ đại nếu không tìm thấy selector chính xác
            await page.keyboard.press('Escape'); // Thoát các popup nếu có
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
        }

    } catch (e) {
        console.error("❌ Lỗi nghiêm trọng khi gửi tin nhắn:", e.message);
    }
}

startZaloBot();
