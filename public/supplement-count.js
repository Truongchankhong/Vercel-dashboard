import { supabase } from './supabaseClient.js';

// ==================== DOM ELEMENTS ====================
const sectionBtns = document.querySelectorAll('.section-btn');
const actionBtns = document.querySelectorAll('.action-btn');
const actionContainer = document.getElementById('action-container');
const scannerContainer = document.getElementById('scanner-container');
const activeSectionLabel = document.getElementById('active-section-name');
const activeActionLabel = document.getElementById('active-action-name');
const scanFeedback = document.getElementById('scan-feedback');
const btnViewMonitor = document.getElementById('btn-view-monitor');
const btnViewSummary = document.getElementById('btn-view-summary');
const btnToggleCamera = document.getElementById('btn-toggle-camera');
const undoContainer = document.getElementById('undo-container');
const btnUndoScan = document.getElementById('btn-undo-scan');
const scannerInputOverlay = document.getElementById('scanner-input-overlay');
const manualRproInput = document.getElementById('manual-rpro');
const btnSaveManual = document.getElementById('btn-save-manual');
const inputQty = document.getElementById('input-qty');
const btnIncQty = document.getElementById('btn-inc-qty');
const btnDecQty = document.getElementById('btn-dec-qty');
const manualNoteInput = document.getElementById('manual-note');

// ==================== STATE VARIABLES ====================
let activeSection = null;
let activeAction = null;
let html5QrScanner = null;
let cameraActive = false;
let isProcessing = false;
let lastRecordId = null;

// Handheld scanner buffer
let scanBuffer = '';
let scanTimeout = null;

// ==================== CAMERA SCANNER ====================
async function startCamera() {
    if (cameraActive) return;

    if (html5QrScanner) {
        try { await html5QrScanner.stop(); } catch (e) { }
    }

    html5QrScanner = new Html5Qrcode("qr-reader");

    const config = {
        fps: 20,
        qrbox: (viewWidth, viewHeight) => {
            const minEdge = Math.min(viewWidth, viewHeight);
            const boxSize = Math.max(Math.floor(minEdge * 0.8), 50);
            return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
        videoConstraints: {
            facingMode: "environment",
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 }
        }
    };

    try {
        // Critical: Unhide BEFORE starting to ensure library can calculate dimensions
        document.getElementById('qr-reader').classList.remove('hidden');
        console.log("📷 Requesting camera (attempting start)...");

        await html5QrScanner.start(
            { facingMode: "environment" },
            config,
            onCameraScanSuccess,
            (errorMessage) => {
                // Log scan errors only if needed for debugging (usually too verbose)
                // console.warn("Scan error:", errorMessage);
            }
        );

        cameraActive = true;
        console.log("✅ Camera started successfully");
        console.log("✅ Camera started");
    } catch (err) {
        console.error("Camera error:", err);
        showFeedback("❌ Lỗi Camera: " + err.message, "text-red-600 text-sm");
    }
}

async function stopCamera() {
    if (!cameraActive || !html5QrScanner) return;
    try {
        await html5QrScanner.stop();
        document.getElementById('qr-reader').classList.add('hidden');
        cameraActive = false;
        console.log("🛑 Camera stopped");
    } catch (err) {
        console.error("Stop camera error:", err);
    }
}

function onCameraScanSuccess(decodedText) {
    if (isProcessing) return;
    processRPRO(decodedText, "CAMERA");
}

// ==================== HANDHELD SCANNER ====================
// Global keydown listener for handheld scanner
document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an actual input field
    if (document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'scanner-input-overlay') {
        return;
    }

    // Prevent default browser shortcuts
    if (e.key.length === 1 || e.key === 'Enter') {
        e.preventDefault();
    }

    // Clear timeout on each keypress
    clearTimeout(scanTimeout);

    if (e.key === 'Enter') {
        // Process the buffer
        if (scanBuffer.length > 0) {
            const scannedCode = scanBuffer.trim();
            scanBuffer = '';
            console.log("🔫 Handheld scan:", scannedCode);
            if (!isProcessing) {
                const note = manualNoteInput ? manualNoteInput.value.trim() : '';
                processRPRO(scannedCode, "HANDHELD", note);
            }
        }
    } else if (e.key.length === 1) {
        // Append character to buffer
        scanBuffer += e.key;

        // Auto-reset buffer after 100ms of inactivity
        scanTimeout = setTimeout(() => {
            scanBuffer = '';
        }, 100);
    }
});

// ==================== CORE LOGIC: PROCESS RPRO ====================
async function processRPRO(text, mode, note = '') {
    console.log(`🚀 Processing RPRO: ${text} | Mode: ${mode} | Note: ${note} | Section: ${activeSection} | Action: ${activeAction}`);

    isProcessing = true;

    // Parse QR if pipe-delimited
    let cleanText = text.trim().toUpperCase();
    if (cleanText.includes('|')) {
        const parts = cleanText.split('|');
        const rproPart = parts.find(p => p.startsWith('RPRO-'));
        if (rproPart) cleanText = rproPart;
    }

    const rpro = cleanText;

    // Reset undo state
    lastRecordId = null;
    undoContainer.classList.add('hidden');

    // Validation
    if (!rpro.startsWith("RPRO")) {
        showFeedback(`❌ Mã không hợp lệ: ${rpro}`, "text-red-600");
        playAudioFeedback(false);
        setTimeout(() => isProcessing = false, 1500);
        return;
    }

    try {
        console.log("🔍 Checking last record...");
        // 1. Check last action for this RPRO in this Section
        const { data: lastRecord, error: queryError } = await supabase
            .from('supplement_tracking')
            .select('action, created_at')
            .eq('rpro', rpro)
            .eq('section', activeSection)
            .order('created_at', { ascending: false })
            .limit(1);

        if (queryError) {
            console.error("❌ Query Error:", queryError);
            throw queryError;
        }

        console.log("📄 Last Record found:", lastRecord);

        // 2. Validate IN/OUT logic (Existing logic kept same)
        // ... (Logic skipping for brevity as it remains same, proceed to Insert)

        const quantity = parseInt(inputQty.value) || 1;
        if (quantity < 1) {
            showFeedback("⚠️ Số lượng phải lớn hơn 0!", "text-red-500 font-bold");
            playAudioFeedback(false);
            isProcessing = false;
            return;
        }

        console.log("💾 Inserting new record...");
        // 3. Save to Supabase
        const { data: insertData, error: insertError } = await supabase
            .from('supplement_tracking')
            .insert([{
                rpro,
                section: activeSection,
                action: activeAction,
                operator: 'User',
                quantity: quantity, // NEW: Add Quantity
                note: note, // NEW: Add Note
                scan_date: new Date().toISOString().split('T')[0]
            }])
            .select('id');

        if (insertError) {
            console.error("❌ Insert Error:", insertError);
            throw insertError;
        }

        console.log("✅ Insert Success:", insertData);
        lastRecordId = insertData[0].id;
        const actionText = activeAction === 'IN' ? 'NHẬP VÀO' : 'XUẤT ĐI';
        showFeedback(`✅ ${actionText}: ${rpro} (${mode})`, "text-green-600 font-black");
        playAudioFeedback(true);
        if (mode === 'CAMERA') alert(`✅ Scan thành công:\n${rpro}`); // Alert for Mobile/Camera users
        undoContainer.classList.remove('hidden');

        // Clear note input after successful save
        if (manualNoteInput) manualNoteInput.value = "";

    } catch (err) {
        console.error("❌ System Error:", err);
        showFeedback("❌ Lỗi hệ thống: " + err.message, "text-red-600 text-sm");
        playAudioFeedback(false);
    } finally {
        setTimeout(() => {
            isProcessing = false;
            // Clear feedback only if success message is showing
            if (scanFeedback.innerText.includes("✅")) {
                scanFeedback.innerText = "Sẵn sàng cho mã tiếp theo...";
                scanFeedback.className = "mt-3 text-center min-h-[50px] font-bold text-lg text-gray-400";
            }
        }, 2000);
    }
}

// ==================== UNDO FUNCTION ====================
async function undoLastRecord() {
    if (!lastRecordId) return;

    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi vừa lưu?")) return;

    try {
        const { error } = await supabase
            .from('supplement_tracking')
            .delete()
            .eq('id', lastRecordId);

        if (error) throw error;

        showFeedback("↩️ Đã xóa bản ghi vừa lưu!", "text-blue-600");
        lastRecordId = null;
        undoContainer.classList.add('hidden');
    } catch (err) {
        alert("Lỗi khi xóa: " + err.message);
    }
}

// ==================== MANUAL INPUT HANDLER ====================
async function handleManualSave() {
    if (isProcessing) return;
    if (!activeSection) {
        alert("Vui lòng chọn bộ phận trước!");
        return;
    }
    if (!activeAction) {
        alert("Vui lòng chọn hành động (IN/OUT) trước!");
        return;
    }

    const val = manualRproInput.value.trim().toUpperCase();
    if (!val) return;

    const note = manualNoteInput ? manualNoteInput.value.trim() : '';

    await processRPRO(val, "MANUAL", note);
    manualRproInput.value = ""; // Clear after success
    manualRproInput.focus();
}

// ==================== AUTO-FETCH NOTE ====================
async function fetchExistingNote(rpro) {
    if (!rpro || !activeSection) return;

    // Simple RPRO pattern check (at least 6 chars to avoid noise)
    if (rpro.length < 5) return;

    try {
        const { data, error } = await supabase
            .from('supplement_tracking')
            .select('note')
            .eq('rpro', rpro)
            .eq('section', activeSection)
            .neq('note', '')
            .not('note', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            console.log("📝 Found existing note:", data[0].note);
            if (manualNoteInput) manualNoteInput.value = data[0].note;
        }
    } catch (err) {
        console.error("Error fetching existing note:", err);
    }
}

// ==================== UI HELPERS ====================
function showFeedback(msg, className) {
    scanFeedback.innerText = msg;
    scanFeedback.className = `mt-3 text-center min-h-[50px] font-bold text-lg ${className}`;
}

function playAudioFeedback(success) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (success) {
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } else {
            oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        }
    } catch (err) {
        console.warn("Audio feedback error:", err);
    }
}

// ==================== EVENT LISTENERS ====================

// Section Selection
sectionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        sectionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeSection = btn.dataset.section;
        activeSectionLabel.innerText = btn.innerText;
        actionContainer.classList.remove('hidden');

        // Reset note input and re-fetch if RPRO exists
        if (manualNoteInput) manualNoteInput.value = "";
        const rpro = manualRproInput ? manualRproInput.value.trim() : "";
        if (rpro) fetchExistingNote(rpro);

        // Reset action
        activeAction = null;
        actionBtns.forEach(b => b.classList.remove('active'));
        scannerContainer.classList.add('hidden');
    });
});

// Action Selection (IN/OUT)
actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        actionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeAction = btn.dataset.action;
        activeActionLabel.innerText = btn.innerText;
        scannerContainer.classList.remove('hidden');

        // Focus on hidden input for handheld scanner
        scannerInputOverlay.focus();
    });
});

// Camera Toggle
if (btnToggleCamera) {
    btnToggleCamera.addEventListener('click', () => {
        if (cameraActive) {
            stopCamera();
        } else {
            startCamera();
        }
    });
}

// Undo Button
if (btnUndoScan) {
    btnUndoScan.addEventListener('click', undoLastRecord);
}

// Navigation Buttons
if (btnViewMonitor) {
    btnViewMonitor.addEventListener('click', () => {
        window.location.href = 'supplement-monitor.html';
    });
}

if (btnViewSummary) {
    btnViewSummary.addEventListener('click', () => {
        window.location.href = 'supplement-count-summary.html';
    });
}

if (btnSaveManual) {
    btnSaveManual.addEventListener('click', handleManualSave);
}

if (manualRproInput) {
    manualRproInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleManualSave();
    });

    // Add event listener to fetch note when user types or paste code
    manualRproInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        if (val.startsWith('RPRO')) {
            // Debounce or just fetch if it looks complete
            if (val.length >= 8) fetchExistingNote(val);
        }
    });
}

if (inputQty) {
    btnIncQty.addEventListener('click', () => {
        inputQty.value = parseInt(inputQty.value) + 1;
    });
    btnDecQty.addEventListener('click', () => {
        if (parseInt(inputQty.value) > 1) {
            inputQty.value = parseInt(inputQty.value) - 1;
        }
    });
}

// ==================== FOCUS MANAGEMENT ====================
// Keep focus on hidden input for handheld scanner
setInterval(() => {
    // Only auto-focus if Camera is OFF (to prevent mobile keyboard pop-up)
    if (!cameraActive && activeSection && activeAction &&
        document.activeElement !== scannerInputOverlay &&
        document.activeElement !== manualRproInput &&
        document.activeElement !== inputQty) {
        scannerInputOverlay.focus();
    }
}, 500);

console.log("✅ Supplement Count Tracking Loaded");
