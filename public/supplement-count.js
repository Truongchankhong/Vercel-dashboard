
import { supabase } from './supabaseClient.js';

const sectionBtns = document.querySelectorAll('.section-btn');
const scannerContainer = document.getElementById('scanner-container');
const activeSectionLabel = document.getElementById('active-section-name');
const scanFeedback = document.getElementById('scan-feedback');
const btnViewSummary = document.getElementById('btn-view-summary');

const undoContainer = document.getElementById('undo-container');
const btnUndoScan = document.getElementById('btn-undo-scan');

let activeSection = null;
let html5QrScanner = null;
let isProcessing = false;
let lastScanId = null;

// Initialize camera
async function startScanner() {
    if (html5QrScanner) {
        try { await html5QrScanner.stop(); } catch (e) { }
    }

    html5QrScanner = new Html5Qrcode("qr-reader");

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    html5QrScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error("Camera start error:", err);
        showFeedback("❌ Không thể mở Camera. Vui lòng cấp quyền!", "text-red-600");
    });
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    handleScannedRPRO(decodedText);
}

function onScanFailure(error) {
    // Usual errors during scan cycle, ignore for smoothness
}

async function handleScannedRPRO(text) {
    isProcessing = true;
    const rpro = text.trim();

    // Reset undo state for new scan
    lastScanId = null;
    undoContainer.classList.add('hidden');

    // 1. Validation
    if (!rpro.startsWith("RPRO")) {
        showFeedback(`❌ Mã không hợp lệ: ${rpro}`, "text-red-600");
        playAudioFeedback(false);
        setTimeout(() => isProcessing = false, 2000);
        return;
    }

    try {
        // 2. Duplicate Check (Today & Section) using the dedicated scan_date column
        const today = new Date().toISOString().split('T')[0];
        const { data, error: checkError } = await supabase
            .from('supplement_counting')
            .select('id')
            .eq('rpro', rpro)
            .eq('section', activeSection)
            .eq('scan_date', today);

        if (checkError) throw checkError;

        if (data && data.length > 0) {
            showFeedback(`⚠️ Trùng mã: ${rpro} đã quét rồi!`, "text-yellow-600 font-black");
            playAudioFeedback(false);
            setTimeout(() => isProcessing = false, 2500);
            return;
        }

        // 3. Save to Supabase (returning the ID for Undo)
        const { data: insertData, error: insertError } = await supabase
            .from('supplement_counting')
            .insert([{ rpro, section: activeSection }])
            .select('id');

        if (insertError) throw insertError;

        lastScanId = insertData[0].id;
        showFeedback(`✅ Thành công: ${rpro}`, "text-green-600");
        playAudioFeedback(true);
        undoContainer.classList.remove('hidden');

    } catch (err) {
        console.error("Supabase Error:", err);
        showFeedback("❌ Lỗi hệ thống: " + err.message, "text-red-600");
    } finally {
        setTimeout(() => {
            isProcessing = false;
            if (scanFeedback.innerText.includes("Thành công")) {
                scanFeedback.innerText = "Sẵn sàng cho mã tiếp theo...";
            }
        }, 1500);
    }
}

async function undoLastScan() {
    if (!lastScanId) return;

    if (!confirm("Bạn có chắc chắn muốn xóa mã vừa quét không?")) return;

    try {
        const { error } = await supabase
            .from('supplement_counting')
            .delete()
            .eq('id', lastScanId);

        if (error) throw error;

        showFeedback("↩️ Đã xóa mã vừa quét!", "text-blue-600");
        lastScanId = null;
        undoContainer.classList.add('hidden');
    } catch (err) {
        alert("Lỗi khi xóa: " + err.message);
    }
}

function showFeedback(msg, className) {
    scanFeedback.innerText = msg;
    scanFeedback.className = `mt-3 text-center min-h-[40px] font-bold ${className}`;
}

function playAudioFeedback(success) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (success) {
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    } else {
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

// Event Listeners
sectionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        sectionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeSection = btn.dataset.section;
        activeSectionLabel.innerText = btn.innerText;
        scannerContainer.classList.remove('hidden');

        startScanner();
    });
});

if (btnUndoScan) {
    btnUndoScan.addEventListener('click', undoLastScan);
}

if (btnViewSummary) {
    btnViewSummary.addEventListener('click', () => {
        window.location.href = 'supplement-count-summary.html';
    });
}
