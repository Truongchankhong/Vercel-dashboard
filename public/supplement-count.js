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
            const boxSize = Math.floor(minEdge * 0.8);
            // Ensure minimum 50px as required by html5-qrcode
            return Math.max(boxSize, 50);
        },
        aspectRatio: 1.0,
        videoConstraints: {
            facingMode: "environment",
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 }
        }
    };

    try {
        await html5QrScanner.start(
            { facingMode: "environment" },
            config,
            onCameraScanSuccess,
            () => { } // Ignore scan failures
        );
        document.getElementById('qr-reader').classList.remove('hidden');
        cameraActive = true;
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
                processRPRO(scannedCode, "HANDHELD");
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
async function processRPRO(text, mode) {
    isProcessing = true;
    const rpro = text.trim().toUpperCase();

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
        // 1. Check last action for this RPRO in this Section
        const { data: lastRecord, error: queryError } = await supabase
            .from('supplement_tracking')
            .select('action, created_at')
            .eq('rpro', rpro)
            .eq('section', activeSection)
            .order('created_at', { ascending: false })
            .limit(1);

        if (queryError) throw queryError;

        // 2. Validate IN/OUT logic
        if (lastRecord && lastRecord.length > 0) {
            const lastAction = lastRecord[0].action;

            if (activeAction === 'IN' && lastAction === 'IN') {
                showFeedback(`⚠️ Mã ${rpro} đã IN rồi! Cần OUT trước khi IN lại.`, "text-yellow-600 font-black text-sm");
                playAudioFeedback(false);
                setTimeout(() => isProcessing = false, 2500);
                return;
            }

            if (activeAction === 'OUT' && lastAction === 'OUT') {
                showFeedback(`⚠️ Mã ${rpro} đã OUT rồi! Cần IN trước khi OUT lại.`, "text-yellow-600 font-black text-sm");
                playAudioFeedback(false);
                setTimeout(() => isProcessing = false, 2500);
                return;
            }
        } else {
            // First time scanning this RPRO in this section
            if (activeAction === 'OUT') {
                showFeedback(`⚠️ Mã ${rpro} chưa IN! Phải IN trước khi OUT.`, "text-yellow-600 font-black text-sm");
                playAudioFeedback(false);
                setTimeout(() => isProcessing = false, 2500);
                return;
            }
        }

        // 3. Save to Supabase
        const { data: insertData, error: insertError } = await supabase
            .from('supplement_tracking')
            .insert([{
                rpro,
                section: activeSection,
                action: activeAction,
                operator: 'User' // Replace with actual user if you have auth
            }])
            .select('id');

        if (insertError) throw insertError;

        lastRecordId = insertData[0].id;
        const actionText = activeAction === 'IN' ? 'NHẬP VÀO' : 'XUẤT ĐI';
        showFeedback(`✅ ${actionText}: ${rpro} (${mode})`, "text-green-600 font-black");
        playAudioFeedback(true);
        undoContainer.classList.remove('hidden');

    } catch (err) {
        console.error("Supabase Error:", err);
        showFeedback("❌ Lỗi hệ thống: " + err.message, "text-red-600 text-sm");
        playAudioFeedback(false);
    } finally {
        setTimeout(() => {
            isProcessing = false;
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

    await processRPRO(val, "MANUAL");
    manualRproInput.value = ""; // Clear after success
    manualRproInput.focus();
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
}

// ==================== FOCUS MANAGEMENT ====================
// Keep focus on hidden input for handheld scanner
setInterval(() => {
    if (activeSection && activeAction &&
        document.activeElement !== scannerInputOverlay &&
        document.activeElement !== manualRproInput) {
        scannerInputOverlay.focus();
    }
}, 500);

console.log("✅ Supplement Count Tracking Loaded");
