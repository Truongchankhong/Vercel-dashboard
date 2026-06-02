
import puppeteer from 'puppeteer';
import { generateAIResponse } from './api/ai-core.js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
let GROUP_NAME_KEYWORD = "AI Assistant"; // Tên nhóm Zalo cần theo dõi
const BOT_TRIGGER = "@AI"; // Từ khóa để gọi Bot
let CHECK_INTERVAL = 3000; // Kiểm tra tin nhắn mỗi 3 giây

// --- LOAD INITIAL CONFIG ---
try {
    const configPath = path.resolve('bot-config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.group_name) {
            GROUP_NAME_KEYWORD = config.group_name;
            console.log(`⚙️ Đã cấu hình nhóm Zalo cần theo dõi: "${GROUP_NAME_KEYWORD}"`);
        }
        if (config.check_interval_ms) {
            CHECK_INTERVAL = config.check_interval_ms;
        }
    }
} catch (e) {
    console.error("⚠️ Không thể tải cấu hình khởi tạo từ bot-config.json:", e.message);
}

// --- HELPER: Auto-navigate to the correct group ---
async function navigateToGroup(page, groupName) {
    try {
        console.log(`🔄 Đang tự động chuyển về nhóm "${groupName}"...`);

        // Bước 1: Tìm và click thanh search
        const searchSelectors = [
            '#contact-search-input',
            'input[placeholder="Tìm kiếm"]',
            'input[placeholder="Search"]',
            '.global-search-box input'
        ];

        let searchFound = false;
        for (const selector of searchSelectors) {
            try {
                const el = await page.$(selector);
                if (el) {
                    await el.click();
                    await new Promise(r => setTimeout(r, 500));
                    // Clear existing text
                    await page.keyboard.down('Control');
                    await page.keyboard.press('a');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await new Promise(r => setTimeout(r, 300));
                    // Type group name
                    await page.keyboard.type(groupName, { delay: 100 });
                    searchFound = true;
                    break;
                }
            } catch (e) { }
        }

        if (!searchFound) {
            // Fallback: use Ctrl+F
            await page.keyboard.down('Control');
            await page.keyboard.press('F');
            await page.keyboard.up('Control');
            await new Promise(r => setTimeout(r, 1000));
            await page.keyboard.type(groupName, { delay: 100 });
        }

        // Bước 2: Chờ kết quả search
        await new Promise(r => setTimeout(r, 2000));

        // Bước 3: Tìm và click vào kết quả có tên nhóm chính xác
        const clicked = await page.evaluate((name) => {
            const nameLower = name.toLowerCase();
            // Tìm tất cả element có thể là item search result
            const allElements = document.querySelectorAll('div, span, a, li, p');
            for (const el of allElements) {
                const text = (el.textContent || '').trim();
                // Tìm element chứa đúng tên nhóm, có kích thước hợp lý (không quá lớn)
                if (text.toLowerCase().includes(nameLower) && text.length < 100 && text.length > name.length - 3) {
                    // Kiểm tra element này có clickable không (có height > 0)
                    const rect = el.getBoundingClientRect();
                    if (rect.height > 10 && rect.height < 200) {
                        el.click();
                        return true;
                    }
                }
            }
            return false;
        }, groupName);

        if (clicked) {
            console.log(`✅ Đã click vào nhóm "${groupName}" từ kết quả search.`);
        } else {
            // Fallback: Enter để chọn kết quả đầu tiên
            await page.keyboard.press('Enter');
            console.log(`↵ Đã nhấn Enter để chọn kết quả đầu tiên.`);
        }

        // Bước 4: Đóng search panel (nhấn Escape)
        await new Promise(r => setTimeout(r, 2000));
        await page.keyboard.press('Escape');

        console.log(`🔄 Hoàn tất chuyển nhóm. Chờ verify...`);
    } catch (err) {
        console.error(`❌ Lỗi khi chuyển nhóm: ${err.message}`);
    }
}

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
    let currentTriggers = ["@AI", "@Auto Report", "/ai", "bot", "@Xuân Trường", "Trường ơi"];
    let lastConfigCheck = 0;
    let debugCounter = 0; // Đếm số lần debug log (chỉ log 3 lần đầu)
    let lastBotReply = ""; // Lưu câu trả lời cuối cùng của bot để bỏ qua

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
            // Zalo Web DOM thay đổi liên tục, cần nhiều chiến lược để detect tên nhóm
            const headerTitleEl = await page.evaluate((keyword) => {
                // Strategy 1: Các selector cụ thể cho header nhóm Zalo
                const selectors = [
                    'header .header-title',
                    '.title-header',
                    '.header-info h1',
                    '.header-info .title',
                    '#header-title',
                    '.chat-info-header .text',
                    '.conv-name',
                    '.chat-title',
                    '.group-name',
                    // Zalo web 2024-2026 selectors
                    'h2.truncate',
                    '.truncate.font-medium',
                    'span.truncate',
                    '.header-chat .name',
                    '.chat-header .name',
                    // "4 thành viên" pattern - tìm element gần nó
                    'header h1', 'header h2', 'header h3',
                    'header span.font-bold', 'header span.font-semibold',
                    'header p.font-bold', 'header p.font-semibold'
                ];
                for (const s of selectors) {
                    const el = document.querySelector(s);
                    if (el && el.textContent && el.textContent.trim().length > 0) {
                        return el.textContent.trim();
                    }
                }

                // Strategy 2: Tìm trong header area - lấy text đầu tiên có vẻ là tên nhóm
                const headerEl = document.querySelector('header') || document.querySelector('[class*="header"]');
                if (headerEl) {
                    // Tìm tất cả text nodes có nội dung ngắn (tên nhóm thường < 50 ký tự)
                    const walker = document.createTreeWalker(headerEl, NodeFilter.SHOW_TEXT, null, false);
                    const candidates = [];
                    let node;
                    while (node = walker.nextNode()) {
                        const text = node.textContent.trim();
                        // Tên nhóm: > 2 ký tự, < 50 ký tự, không phải số thuần, không phải "thành viên"
                        if (text.length > 2 && text.length < 50 &&
                            !text.match(/^\d+$/) &&
                            !text.includes('thành viên') &&
                            !text.includes('member') &&
                            !text.includes('online') &&
                            !text.includes('Đang hoạt động')) {
                            candidates.push(text);
                        }
                    }
                    if (candidates.length > 0) return candidates[0];
                }

                // Strategy 3: Fallback - tìm keyword trực tiếp trong page title hoặc top area
                const pageTitle = document.title;
                if (pageTitle && pageTitle.includes(keyword)) return keyword;

                return "";
            }, GROUP_NAME_KEYWORD);

            // Chuẩn hóa chuỗi để so sánh (Trim + lowercase + collapse spaces)
            const cleanHeader = headerTitleEl ? headerTitleEl.trim().replace(/\s+/g, ' ').toLowerCase() : "";
            const cleanKeyword = GROUP_NAME_KEYWORD.trim().replace(/\s+/g, ' ').toLowerCase();

            // CRITICAL FIX: Nếu KHÔNG detect được header → coi như KHÔNG AN TOÀN
            if (!cleanHeader) {
                console.log(`⚠️ Không detect được tên nhóm hiện tại. Đang thử tìm lại nhóm "${GROUP_NAME_KEYWORD}"...`);
                await navigateToGroup(page, GROUP_NAME_KEYWORD);
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            if (!cleanHeader.includes(cleanKeyword)) {
                console.log(`🔒 Đang ở nhóm khác: "${headerTitleEl}". Đang tự động chuyển về "${GROUP_NAME_KEYWORD}"...`);
                await navigateToGroup(page, GROUP_NAME_KEYWORD);
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            // =================================================================
            // CRITICAL: CHỈ ĐỌC TIN NHẮN TRONG VÙNG CHAT CHÍNH (BÊN PHẢI)
            // Chiến lược: GENERIC DOM WALK + POSITION FILTER
            // Không dựa vào CSS class cụ thể (vì Zalo thay đổi liên tục)
            // =================================================================

            let lastMsgEl = null;
            let textContent = "";

            const allCandidates = await page.evaluate((debugMode) => {
                const results = [];

                // === BƯỚC 1: Xác định ranh giới LEFT/RIGHT ===
                // Tìm input box (#input_line_0) - CHẮC CHẮN nằm bên phải
                const inputBox = document.querySelector('#input_line_0') ||
                    document.querySelector('div[contenteditable="true"]');

                let rightBoundary = 250; // Default: sidebar thường rộng ~250px
                if (inputBox) {
                    const inputRect = inputBox.getBoundingClientRect();
                    // Input box nằm bên phải → lấy x của nó làm ranh giới tối thiểu
                    // Trừ thêm margin (tin nhắn có thể nằm lệch trái hơn input)
                    rightBoundary = Math.max(200, inputRect.x - 100);
                }

                // === BƯỚC 2: DOM INSPECTION (chạy 1 lần để debug) ===
                let debugData = null;
                if (debugMode) {
                    // Tìm TẤT CẢ elements có text, lọc theo vị trí x > rightBoundary
                    const allEls = document.querySelectorAll('div, span, p');
                    const samples = [];
                    for (const el of allEls) {
                        const rect = el.getBoundingClientRect();
                        if (rect.x < rightBoundary) continue; // Bỏ qua sidebar
                        if (rect.width < 50 || rect.height < 10) continue; // Quá nhỏ
                        if (rect.height > 500) continue; // Quá lớn (container)

                        const text = (el.innerText || el.textContent || '').trim();
                        if (text.length > 2 && text.length < 500) {
                            samples.push({
                                tag: el.tagName,
                                class: el.className ? el.className.substring(0, 80) : '',
                                id: el.id || '',
                                text: text.substring(0, 100),
                                x: Math.round(rect.x),
                                y: Math.round(rect.y),
                                w: Math.round(rect.width),
                                h: Math.round(rect.height)
                            });
                        }
                    }
                    // Lấy 20 sample cuối (tin nhắn mới nhất ở cuối page)
                    debugData = samples.slice(-20);
                }

                // === BƯỚC 3: TÌM TIN NHẮN - MESSAGE CONTAINER APPROACH ===
                // Thay vì đọc leaf elements (bị tách mention ra riêng),
                // tìm MESSAGE CONTAINER (parent chứa đầy đủ nội dung tin nhắn)
                const allEls = document.querySelectorAll('div, span, p');
                const seenTexts = new Set();
                const rawCandidates = [];

                for (const el of allEls) {
                    const rect = el.getBoundingClientRect();

                    // CHỈ lấy elements bên PHẢI (chat panel)
                    if (rect.x < rightBoundary) continue;
                    if (rect.width < 30 || rect.height < 10) continue;
                    if (rect.height > 400) continue;

                    const elText = (el.innerText || '').trim();
                    if (elText.length < 2 || elText.length > 2000) continue;

                    // === WALK UP: Tìm message container ===
                    // Zalo render mention (@Auto Report) trong <span> riêng
                    // → cần lấy text từ PARENT để có đầy đủ nội dung
                    let bestText = elText;
                    let bestEl = el;
                    let parent = el.parentElement;
                    for (let d = 0; d < 8 && parent; d++) {
                        const pRect = parent.getBoundingClientRect();
                        // Parent hợp lệ: bên phải, height hợp lý (20-300px)
                        if (pRect.x >= rightBoundary && pRect.height > 15 && pRect.height < 300) {
                            const pText = (parent.innerText || '').trim();
                            // Nếu parent có NHIỀU text hơn và chứa text con → ưu tiên parent
                            if (pText.length > bestText.length && pText.length < 2000) {
                                // Nhưng KHÔNG lấy nếu parent chứa quá nhiều tin nhắn
                                // (ví dụ: container chứa 10 tin nhắn liền nhau)
                                const lineCount = pText.split('\n').length;
                                if (lineCount <= 5) {
                                    bestText = pText;
                                    bestEl = parent;
                                }
                            }
                        }
                        parent = parent.parentElement;
                    }

                    // === LỌC RÁC ===
                    let text = bestText;

                    // 1. Timestamp patterns
                    if (/^\d{1,2}:\d{2}$/.test(text)) continue;
                    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) continue;

                    // 2. Zalo reaction/emoji fragments
                    if (/^\/-?\w+$/.test(text)) continue;
                    if ((text.startsWith('/-') || text.startsWith('/')) && text.length < 20) continue;

                    // 3. Typing indicators & system text
                    const garbage = [
                        'Chưa có tin nhắn', 'Tin nhắn đã thu hồi', 'Đã thu hồi',
                        'Hình ảnh', 'Video', 'File đính kèm', 'Sticker',
                        'Gửi vị trí', 'Thẻ liên hệ', 'Đã gửi', 'Đã nhận', 'Đã xem',
                        'Tải Zalo PC', 'Sử dụng Zalo PC', 'Nhập @',
                        'thành viên', 'member', 'trò chuyện',
                        'Zalo chỉ hiển thị', 'đầu tiên trên trình duyệt',
                        'Vui lòng sử dụng', 'lưu trữ dài hạn',
                        'Tải ngay', 'Tải Zalo', 'xem đầy đủ',
                        'Activate Windows', 'Go to Setti',
                        'đang soạn tin', 'Đang soạn tin', 'đang nhập',
                        'typing', 'Đang gõ', 'soạn tin',
                        'Nhóm:', 'nhắc đến bạn'
                    ];
                    // Chỉ lọc rác nếu text chứa từ khóa rác (tránh lọc tin nhắn dài có chứa từ khóa)
                    if (text.length < 100 && garbage.some(g => text.includes(g))) continue;

                    // Lọc riêng các nhãn thời gian (chỉ khi chúng đứng một mình hoặc rất ngắn)
                    const timeLabels = ['vài giây', 'phút', 'giờ', 'hôm nay', 'hôm qua', 'vừa xong'];
                    if (text.length < 15 && timeLabels.some(t => text.toLowerCase().includes(t))) continue;

                    // 4. Quá ngắn + chỉ là timestamp/label/symbols
                    if (text.length < 4 && /^[\d:\/\s\-\w]+$/.test(text)) continue;

                    // 5. [REMOVED] Sender name filter was too aggressive and filtered out short messages
                    // We rely on DOM order (message usually comes after name) and deduplication.

                    // Clean whitespace and newlines for better keyword matching
                    text = text.replace(/\s+/g, ' ').trim();

                    // 6. Tránh duplicate
                    if (seenTexts.has(text)) continue;
                    seenTexts.add(text);

                    rawCandidates.push({
                        text: text,
                        x: Math.round(rect.x),
                        y: Math.round(bestEl.getBoundingClientRect().y),
                        h: Math.round(bestEl.getBoundingClientRect().height),
                        tag: bestEl.tagName
                    });
                }

                // === BƯỚC 4: DEDUP - Giữ lại text DÀI NHẤT khi trùng lặp ===
                const validCandidates = [];
                for (const candidate of rawCandidates) {
                    let isSubstring = false;
                    for (const other of rawCandidates) {
                        if (other === candidate) continue;
                        if (other.text.length > candidate.text.length &&
                            other.text.includes(candidate.text)) {
                            isSubstring = true;
                            break;
                        }
                    }
                    if (!isSubstring) {
                        const alreadyExists = validCandidates.some(r => r.text === candidate.text);
                        if (!alreadyExists) {
                            validCandidates.push(candidate);
                        }
                    }
                }

                // === BƯỚC 5: SORT BY POSITION (Y-coordinate) ===
                // Rất quan trọng: Phải lấy theo vị trí hiển thị từ trên xuống dưới
                // Tránh trường hợp banner/tooltip nằm ở cuối DOM nhưng hiển thị ở trên đầu
                const finalResults = validCandidates.sort((a, b) => a.y - b.y);

                return {
                    candidates: finalResults,
                    rightBoundary: rightBoundary,
                    totalFound: finalResults.length,
                    debugData: debugData
                };
            }, debugCounter < 3);

            // Debug logging (chỉ log 3 lần đầu)
            if (debugCounter < 3) {
                debugCounter++;
                console.log(`\n🔍 [DEBUG #${debugCounter}] Right boundary: x >= ${allCandidates.rightBoundary}px`);
                console.log(`   Tìm thấy ${allCandidates.totalFound} text elements bên phải.`);

                if (allCandidates.debugData) {
                    console.log(`   📋 DOM SAMPLES (20 cuối cùng):`);
                    for (const s of allCandidates.debugData) {
                        console.log(`      <${s.tag} class="${s.class}"> x=${s.x} y=${s.y} ${s.w}x${s.h} → "${s.text}"`);
                    }
                }

                if (allCandidates.candidates) {
                    console.log(`   📨 Candidates sau lọc rác:`);
                    for (const c of allCandidates.candidates.slice(-5)) {
                        console.log(`      [x=${c.x} y=${c.y}] "${c.text.substring(0, 80)}"`);
                    }
                }
            }

            // Lấy tin nhắn MỚI NHẤT (cuối cùng trong danh sách, vì đã sort theo DOM order)
            const candidates = allCandidates.candidates || [];
            if (candidates.length > 0) {
                // Duyệt ngược từ cuối để tìm tin nhắn KHÔNG PHẢI của bot
                for (let i = candidates.length - 1; i >= 0; i--) {
                    const candidateText = candidates[i].text;
                    // Bỏ qua nếu text = câu trả lời cuối của bot (hoặc 1 phần của nó)
                    if (lastBotReply && (
                        candidateText === lastBotReply ||
                        lastBotReply.includes(candidateText) ||
                        candidateText.includes(lastBotReply.substring(0, 50))
                    )) {
                        continue;
                    }
                    textContent = candidateText;
                    break;
                }
            }

            if (textContent) {
                // Check if new message and NOT empty
                if (textContent && textContent !== lastMessageContent) {
                    lastMessageContent = textContent;
                    console.log(`📩 Hệ thống nhận thấy text thô: "${textContent}"`);

                    // Bỏ qua nếu text chứa nội dung bot vừa trả lời (tránh loop)
                    if (lastBotReply && (
                        textContent.includes(lastBotReply) ||
                        (textContent.length > 20 && lastBotReply.includes(textContent.substring(0, 20)))
                    )) {
                        console.log(`   (Bỏ qua tin nhắn của chính mình để tránh loop)`);
                        continue;
                    }

                    // Check triggers with normalized whitespace
                    const lowerText = textContent.toLowerCase().replace(/\s+/g, ' ');

                    // Ưu tiên các trigger dài/rõ ràng trước, tránh trigger quá ngắn như 'ai' gây false positive
                    const cleanTriggers = currentTriggers
                        .map(t => t.toLowerCase().replace(/\s+/g, ' '))
                        .sort((a, b) => b.length - a.length);

                    const triggerMatch = cleanTriggers.find(t => {
                        // Nếu trigger là 'ai' hoặc 'bot', yêu cầu nó phải là 1 từ riêng biệt hoặc có @
                        if (t === 'ai' || t === 'bot') {
                            return lowerText.includes('@' + t) || new RegExp(`\\b${t}\\b`).test(lowerText);
                        }
                        return lowerText.includes(t);
                    });

                    if (triggerMatch) {
                        console.log(`🤖 Phát hiện lệnh gọi "${triggerMatch}" trong tin nhắn.`);

                        // Chặn thêm nếu text chứa các prefix hệ thống đặc trưng
                        if (textContent.includes("🤖[Hệ thống]") || textContent.includes("Tôi sẵn sàng")) {
                            console.log("   (Xác nhận đây là tin nhắn hệ thống, bỏ qua)");
                            continue;
                        }

                        // Mark as read (optional, by clicking)
                        if (lastMsgEl) {
                            try { await lastMsgEl.click(); } catch (e) { }
                        }

                        // Generate AI response
                        const triggerIndex = lowerText.indexOf(triggerMatch.toLowerCase());
                        const query = textContent.slice(triggerIndex + triggerMatch.length).trim();

                        if (query.length > 0) {
                            console.log(`🔄 Đang xử lý câu hỏi: "${query}"`);
                            try {
                                const aiReply = await generateAIResponse(textContent);
                                if (aiReply) {
                                    // LƯU câu trả lời của bot vào lastBotReply TRƯỚC khi gửi để filter bắt được ngay
                                    lastBotReply = aiReply.substring(0, 50);
                                    await sendReply(page, aiReply);
                                    console.log(`✅ Đã gửi phản hồi. Sẵn sàng cho câu hỏi tiếp theo.`);
                                }
                            } catch (aiErr) {
                                console.error(`❌ Lỗi AI: ${aiErr.message}`);
                                const errorMsg = "🤖[Hệ thống]: Không kết nối được bộ não AI. Bạn đợi xíu hoặc hỏi lại nhé!";
                                lastBotReply = errorMsg.substring(0, 50);
                                await sendReply(page, errorMsg);
                            }
                        } else {
                            const emNghe = "Dạ em nghe? Anh/Chị cần em giúp gì không ạ?";
                            lastBotReply = emNghe.substring(0, 50);
                            await sendReply(page, emNghe);
                        }
                    } else {
                        console.log(`   (Bỏ qua message: "${textContent.substring(0, 60)}" - Không có từ khóa)`);
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

                    // XÓA NỘI DUNG CŨ (đề phòng bị kẹt chữ)
                    await page.keyboard.down('Control');
                    await page.keyboard.press('a');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await new Promise(r => setTimeout(r, 300));

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
            await page.keyboard.press('Escape');
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
        }

    } catch (e) {
        console.error("❌ Lỗi nghiêm trọng khi gửi tin nhắn:", e.message);
    }
}

startZaloBot();
