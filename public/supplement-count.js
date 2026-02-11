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
const puInfoContainer = document.getElementById('pu-info-container');
const puCodeDisplay = document.getElementById('pu-code-display');

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
    // Set defaults as soon as we have a code
    fetchDetails(decodedText).then(() => {
        processRPRO(decodedText, "CAMERA");
    });
}

// ==================== HANDHELD SCANNER ====================
// Global keydown listener for handheld scanner
document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an actual input field or textarea
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') &&
        document.activeElement.id !== 'scanner-input-overlay') {
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
                fetchDetails(scannedCode).then(() => {
                    processRPRO(scannedCode, "HANDHELD", note);
                });
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

// ==================== AUTO-FETCH NOTE & QUANTITY ====================
async function fetchDetails(rpro) {
    if (!rpro || !activeSection) return;

    // Simple RPRO pattern check
    if (rpro.length < 5) return;

    try {
        console.log(`ℹ️ Fetching details for ${rpro} in ${activeSection}...`);

        // 1. Fetch Note
        const { data: noteData, error: noteError } = await supabase
            .from('supplement_tracking')
            .select('note')
            .eq('rpro', rpro)
            .eq('section', activeSection)
            .neq('note', '')
            .not('note', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!noteError && noteData && noteData.length > 0) {
            console.log("📝 Found existing note:", noteData[0].note);
            if (manualNoteInput) manualNoteInput.value = noteData[0].note;
        }

        // 2. Fetch Default Quantity
        let defaultQty = 1;

        if (activeSection === 'Dán') {
            // "Số đôi có thể bù trong trang Bù hàng- Xác nhận" -> available_supplement in supplement_confirm
            const { data: confirmData, error: confirmError } = await supabase
                .from('supplement_confirm')
                .select('available_supplement, total')
                .eq('rpro', rpro)
                .limit(1);

            if (!confirmError && confirmData && confirmData.length > 0) {
                const rec = confirmData[0];
                defaultQty = (rec.available_supplement !== null) ? rec.available_supplement : rec.total;
                console.log(`📦 Dán: Default quantity from supplement_confirm: ${defaultQty}`);
            } else {
                // Fallback to supplement table total
                const { data: suppData, error: suppError } = await supabase
                    .from('supplement')
                    .select('total')
                    .eq('rpro', rpro)
                    .limit(1);

                if (!suppError && suppData && suppData.length > 0) {
                    defaultQty = suppData[0].total;
                    console.log(`📦 Dán: Fallback to supplement table total: ${defaultQty}`);
                } else {
                    // Fallback to Masterdata total
                    const { data: masterData, error: masterError } = await supabase
                        .from('Masterdata')
                        .select('"Total Qty"')
                        .eq('PRO ODER', rpro)
                        .limit(1);

                    if (!masterError && masterData && masterData.length > 0) {
                        defaultQty = masterData[0]['Total Qty'];
                        console.log(`📦 Dán: Fallback to Masterdata total: ${defaultQty}`);
                    }
                }
            }

            // === FETCH PU CODE ===
            let puCode = null;
            // 1. Try powerapp table
            const { data: puData, error: puError } = await supabase
                .from('powerapp')
                .select('PU')
                .eq('PRO ODER', rpro)
                .limit(1);

            if (!puError && puData && puData.length > 0 && puData[0].PU) {
                puCode = puData[0].PU;
                console.log(`🧪 PU from powerapp: ${puCode}`);
            } else {
                // 2. Fallback to Masterdata
                const { data: puMaster, error: puMasterErr } = await supabase
                    .from('Masterdata')
                    .select('PU')
                    .eq('PRO ODER', rpro)
                    .limit(1);

                if (!puMasterErr && puMaster && puMaster.length > 0 && puMaster[0].PU) {
                    puCode = puMaster[0].PU;
                    console.log(`🧪 PU from Masterdata: ${puCode}`);
                }
            }

            // Display PU code
            if (puInfoContainer && puCodeDisplay) {
                puInfoContainer.classList.remove('hidden');
                puCodeDisplay.textContent = puCode || 'Không tìm thấy thông tin';
                puCodeDisplay.className = puCode
                    ? 'text-center text-lg font-black text-teal-800'
                    : 'text-center text-sm font-semibold text-gray-400 italic';
            }
        } else if (['Cắt', 'Molding', 'DC', 'Molded'].includes(activeSection)) {
            // Hide PU info for non-Dán sections
            if (puInfoContainer) puInfoContainer.classList.add('hidden');

            // "lấy mặc định theo số scan Out của section dán"
            const { data: trackingData, error: trackingError } = await supabase
                .from('supplement_tracking')
                .select('quantity')
                .eq('rpro', rpro)
                .eq('section', 'Dán')
                .eq('action', 'OUT');

            if (!trackingError && trackingData && trackingData.length > 0) {
                defaultQty = trackingData.reduce((sum, item) => sum + (item.quantity || 0), 0);
                console.log(`📦 ${activeSection}: Default quantity from Dán Scan Out: ${defaultQty}`);
            }
        } else {
            // Hide PU info for any other sections
            if (puInfoContainer) puInfoContainer.classList.add('hidden');
        }

        if (inputQty && defaultQty > 0) {
            inputQty.value = defaultQty;
        }

    } catch (err) {
        console.error("Error fetching details:", err);
    }
}

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
        const errorMsg = `❌ Mã không hợp lệ: ${rpro}`;
        showFeedback(errorMsg, "text-red-600");
        showToast(errorMsg, "error");
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
            const errorMsg = "⚠️ Số lượng phải lớn hơn 0!";
            showFeedback(errorMsg, "text-red-500 font-bold");
            showToast(errorMsg, "error");
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
                note: note || (manualNoteInput ? manualNoteInput.value.trim() : ''), // Use current note if not provided
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
        const successMsg = `✅ ${actionText} THÀNH CÔNG: ${rpro}`;
        showFeedback(successMsg, "text-green-600 font-black");
        showToast(successMsg, "success");
        playAudioFeedback(true);
        // if (mode === 'CAMERA') alert(`✅ Scan thành công:\n${rpro}`); // Alert is redundant now with Toast
        undoContainer.classList.remove('hidden');

        // Clear note input after successful save
        if (manualNoteInput) manualNoteInput.value = "";
        if (inputQty) inputQty.value = "1"; // Reset Qty to 1 for next scan

    } catch (err) {
        console.error("❌ System Error:", err);
        const errorMsg = "❌ Lỗi hệ thống: " + err.message;
        showFeedback(errorMsg, "text-red-600 text-sm");
        showToast(errorMsg, "error");
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

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = "success") {
    // Remove existing toast if any
    const existingToast = document.getElementById('floating-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'floating-toast';

    // Base styles
    let baseClass = "fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-xl text-center min-w-[300px] animate-bounce-short transition-all duration-300 transform scale-100 opacity-100";

    if (type === "success") {
        toast.className = `${baseClass} bg-green-500 border-4 border-white`;
    } else {
        toast.className = `${baseClass} bg-red-600 border-4 border-white`;
    }

    toast.innerText = message;
    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) scale(0.9)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        showToast("⚠️ Vui lòng chọn bộ phận trước!", "error");
        return;
    }
    if (!activeAction) {
        showToast("⚠️ Vui lòng chọn hành động (IN/OUT) trước!", "error");
        return;
    }

    const val = manualRproInput.value.trim().toUpperCase();
    if (!val) return;

    const note = manualNoteInput ? manualNoteInput.value.trim() : '';

    await processRPRO(val, "MANUAL", note);
    manualRproInput.value = ""; // Clear after success
    manualRproInput.focus();
}

// Merged fetchExistingNote into fetchDetails above

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

        // Show/hide PU info panel based on section
        if (puInfoContainer) {
            if (activeSection === 'Dán') {
                // Will be populated on scan/fetch
                puInfoContainer.classList.add('hidden');
            } else {
                puInfoContainer.classList.add('hidden');
            }
        }

        // Reset note input and re-fetch if RPRO exists
        if (manualNoteInput) manualNoteInput.value = "";
        const rpro = manualRproInput ? manualRproInput.value.trim() : "";
        if (rpro) fetchDetails(rpro);

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
        if (scannerInputOverlay) {
            // Set inputmode none again just in case
            scannerInputOverlay.setAttribute('inputmode', 'none');
            scannerInputOverlay.focus();
        }
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

    // Add event listener to fetch details when user types or paste code
    manualRproInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        if (val.startsWith('RPRO')) {
            // Debounce or just fetch if it looks complete
            if (val.length >= 8) fetchDetails(val);
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
        document.activeElement !== inputQty &&
        document.activeElement !== manualNoteInput) {
        scannerInputOverlay.focus();
    }
}, 500);

console.log("✅ Supplement Count Tracking Loaded");
