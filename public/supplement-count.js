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
const manualRproInput = document.getElementById('manual-rpro');
const btnSaveManual = document.getElementById('btn-save-manual');
const inputQty = document.getElementById('input-qty');
const btnIncQty = document.getElementById('btn-inc-qty');
const btnDecQty = document.getElementById('btn-dec-qty');
const manualNoteInput = document.getElementById('manual-note');
const puInfoContainer = document.getElementById('pu-info-container');
const puCodeDisplay = document.getElementById('pu-code-display');
const puSheetsEdit = document.getElementById('pu-sheets-edit');
const puSheetsDisplay = document.getElementById('pu-sheets-display');
const inputPuSheets = document.getElementById('input-pu-sheets');
const puSheetsValue = document.getElementById('pu-sheets-value');
const btnIncSheets = document.getElementById('btn-inc-sheets');
const btnDecSheets = document.getElementById('btn-dec-sheets');
const multiRproModal = document.getElementById('multi-rpro-modal');
const multiRproCount = document.getElementById('multi-rpro-count');
const btnMultiContinue = document.getElementById('btn-multi-continue');
const btnMultiGroup = document.getElementById('btn-multi-group');
const btnMultiRescan = document.getElementById('btn-multi-rescan');
const autoSaveCheckbox = document.getElementById('auto-save-checkbox');
const btnQuickHbkd = document.getElementById('btn-quick-hbkd');
const scanHistoryContainer = document.getElementById('scan-history-container');
const scanHistoryList = document.getElementById('scan-history-list');
const btnRefreshScanHistory = document.getElementById('btn-refresh-scan-history');
const importListCheckbox = document.getElementById('import-list-checkbox');
const batchInputContainer = document.getElementById('batch-input-container');
const batchRproTextarea = document.getElementById('batch-rpro-textarea');
const btnProcessBatch = document.getElementById('btn-process-batch');
const btnSaveAllBatch = document.getElementById('btn-save-all-batch');
const hbkdListCheckbox = document.getElementById('hbkd-list-checkbox');
const handheldDot = document.getElementById('handheld-dot');
const handheldStatusText = document.getElementById('handheld-status-text');

// ==================== STATE VARIABLES ====================
let activeSection = null;
let activeAction = null;
let html5QrScanner = null;
let cameraActive = false;
let isProcessing = false;
let lastRecordId = null;
let scanCountTotalVal = 0;
let scanCountErrorVal = 0;
let pendingBatchScans = [];
let isHbkdMode = false;
const scanCountTotalElem = document.getElementById('scan-count-total');
const scanCountErrorElem = document.getElementById('scan-count-error');

// ==================== FLOW CONFIGURATION ====================
function getPreviousSection(section) {
    if (section === 'Cắt') return 'Dán';
    if (section === 'Molding') return 'Cắt';
    if (section === 'DC') return 'Molding';
    if (section === 'Molded') return 'Molding';
    return null;
}

let scanQueue = [];
let isQueueProcessing = false;

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
        document.getElementById('qr-reader').classList.remove('hidden');
        await html5QrScanner.start(
            { facingMode: "environment" },
            config,
            onCameraScanSuccess
        );

        cameraActive = true;
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
    } catch (err) {
        console.error("Stop camera error:", err);
    }
}

async function onCameraScanSuccess(decodedText) {
    if (isProcessing) return;

    const rproMatches = decodedText.match(/RPRO-[\d-]+/g);
    if (rproMatches && rproMatches.length > 1) {
        showMultiRproConfirmation(rproMatches, "CAMERA", "");
    } else {
        const code = (rproMatches && rproMatches.length === 1) ? rproMatches[0] : decodedText.trim().toUpperCase();
        if (!code) return;

        if (manualRproInput) manualRproInput.value = code;
        const status = await fetchDetails(code);

        stopCamera();

        if (status === 'found') {
            showFeedback(`✅ Đã nhận mã ${code} (Có dữ liệu).`, "text-green-600 font-bold bg-green-50 p-2 rounded-lg border-2 border-green-200");
        } else {
            showFeedback(`⚠️ Đơn ${code}: Không có thông tin trên server.`, "text-orange-600 bg-orange-50 p-2 rounded-lg border-2 border-orange-200");
        }

        playAudioFeedback(status === 'found');

        if (autoSaveCheckbox?.checked || isHbkdMode) {
            if (isHbkdMode && manualNoteInput && !manualNoteInput.value.includes('HBKD')) {
                manualNoteInput.value = manualNoteInput.value ? 'HBKD ' + manualNoteInput.value : 'HBKD';
            }
            setTimeout(() => handleManualSave(true), 800);
        }
    }
}

function normalizeRPRO(text) {
    if (!text) return "";
    let clean = text.trim().toUpperCase();

    if (clean.includes('|')) {
        const parts = clean.split('|');
        const found = parts.find(p => p.trim().startsWith('RPRO'));
        if (found) clean = found.trim();
    }

    clean = clean.replace(/^RPRO-+/i, '').replace(/^RPRO/i, '');
    clean = clean.replace(/[^A-Z0-9-]/g, '');

    const pureNumbers = clean.replace(/-/g, '');
    if (pureNumbers.length >= 7) {
        return `RPRO-${pureNumbers.substring(0, 6)}-${pureNumbers.substring(6)}`;
    }
    return "RPRO-" + clean.replace(/-+/g, '-');
}

async function fetchDetails(rawRpro) {
    const rpro = normalizeRPRO(rawRpro);
    if (!rpro || rpro === 'RPRO-' || !activeSection) return false;

    if (rpro.length < 5) return false;

    let foundAnyData = false;
    try {
        let defaultQty = 1;

        if (activeSection === 'Dán') {
            const { data: confirmData, error: confirmError } = await supabase
                .from('supplement_confirm')
                .select('available_supplement, total, so_tam')
                .eq('rpro', rpro)
                .order('created_at', { ascending: false })
                .limit(1);

            let confirmSoTam = null;

            if (!confirmError && confirmData && confirmData.length > 0) {
                const rec = confirmData[0];
                defaultQty = (rec.available_supplement !== null) ? rec.available_supplement : rec.total;
                confirmSoTam = rec.so_tam;
            } else {
                const { data: suppData, error: suppError } = await supabase
                    .from('supplement')
                    .select('total')
                    .eq('rpro', rpro)
                    .limit(1);

                if (!suppError && suppData && suppData.length > 0) {
                    defaultQty = suppData[0].total;
                } else {
                    const { data: masterData, error: masterError } = await supabase
                        .from('Masterdata')
                        .select('"Total Qty"')
                        .eq('PRO ODER', rpro)
                        .limit(1);

                    if (!masterError && masterData && masterData.length > 0) {
                        defaultQty = masterData[0]['Total Qty'];
                    }
                }
            }
            if (defaultQty > 1 || (confirmData && confirmData.length > 0)) foundAnyData = true;

            let puCode = null;
            const { data: puData, error: puError } = await supabase
                .from('powerapp')
                .select('PU')
                .eq('PRO ODER', rpro)
                .limit(1);

            if (!puError && puData && puData.length > 0 && puData[0].PU) {
                puCode = puData[0].PU;
            } else {
                const { data: puMaster, error: puMasterErr } = await supabase
                    .from('Masterdata')
                    .select('PU')
                    .eq('PRO ODER', rpro)
                    .limit(1);

                if (!puMasterErr && puMaster && puMaster.length > 0 && puMaster[0].PU) {
                    puCode = puMaster[0].PU;
                }
            }
            if (puCode) foundAnyData = true;

            if (puInfoContainer && puCodeDisplay) {
                puInfoContainer.classList.remove('hidden');
                puCodeDisplay.textContent = puCode || 'Không tìm thấy thông tin';
            }

            if (puSheetsEdit) puSheetsEdit.classList.remove('hidden');
            if (puSheetsDisplay) puSheetsDisplay.classList.add('hidden');

            if (confirmSoTam !== null && confirmSoTam !== undefined) {
                if (inputPuSheets) inputPuSheets.value = confirmSoTam;
            } else {
                const { data: sheetsData, error: sheetsErr } = await supabase
                    .from('supplement_tracking')
                    .select('pu_sheets')
                    .eq('rpro', rpro)
                    .eq('section', 'Dán')
                    .not('pu_sheets', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!sheetsErr && sheetsData && sheetsData.length > 0 && sheetsData[0].pu_sheets != null) {
                    if (inputPuSheets) inputPuSheets.value = sheetsData[0].pu_sheets;
                } else {
                    if (inputPuSheets) inputPuSheets.value = 1;
                }
            }
        } else if (['Cắt', 'Molding', 'DC', 'Molded'].includes(activeSection)) {
            if (puInfoContainer) puInfoContainer.classList.add('hidden');
            const stagesToSearch = [];
            if (activeSection === 'Cắt') stagesToSearch.push('Dán');
            if (activeSection === 'Molding') stagesToSearch.push('Cắt', 'Dán');
            if (activeSection === 'DC') stagesToSearch.push('Molding', 'Cắt', 'Dán');
            if (activeSection === 'Molded') stagesToSearch.push('Molding', 'Cắt', 'Dán');

            let qtyFromPrev = null;
            for (const stage of stagesToSearch) {
                const { data: prevOut } = await supabase
                    .from('supplement_tracking')
                    .select('quantity')
                    .eq('rpro', rpro)
                    .eq('section', stage)
                    .eq('action', 'OUT')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (prevOut && prevOut.length > 0 && prevOut[0].quantity > 0) {
                    if (prevOut[0].quantity > 1) {
                        qtyFromPrev = prevOut[0].quantity;
                        break;
                    } else if (qtyFromPrev === null) {
                        qtyFromPrev = prevOut[0].quantity;
                    }
                }
            }

            if (qtyFromPrev !== null) {
                defaultQty = qtyFromPrev;
                foundAnyData = true;
            } else {
                const { data: lastAny } = await supabase
                    .from('supplement_tracking')
                    .select('quantity')
                    .eq('rpro', rpro)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (lastAny && lastAny.length > 0 && lastAny[0].quantity > 0) {
                    defaultQty = lastAny[0].quantity;
                    foundAnyData = true;
                }
            }
        } else {
            if (puInfoContainer) puInfoContainer.classList.add('hidden');
        }

        if (inputQty && defaultQty > 0) {
            inputQty.value = defaultQty;
        }

    } catch (err) {
        console.error("Error fetching details:", err);
    }
    return foundAnyData ? 'found' : 'not_found';
}

function showMultiRproConfirmation(matches, mode, note) {
    isProcessing = true;
    multiRproCount.textContent = matches.length;
    multiRproModal.classList.remove('hidden');

    btnMultiContinue.onclick = async () => {
        multiRproModal.classList.add('hidden');
        for (const code of matches) {
            await fetchDetails(code);
            await processRPRO(code, mode, note, true);
        }
        finishProcessingBatch();
    };

    btnMultiGroup.onclick = async () => {
        multiRproModal.classList.add('hidden');
        isProcessing = false;
        const firstRpro = matches[0];
        if (manualRproInput) manualRproInput.value = firstRpro;
        await fetchDetails(firstRpro);
        playAudioFeedback(true);
    };

    btnMultiRescan.onclick = () => {
        multiRproModal.classList.add('hidden');
        isProcessing = false;
    };
}

async function processRPRO(text, mode, note = '', isInBatch = false) {
    const rpro = normalizeRPRO(text);
    if (!isInBatch) isProcessing = true;

    if (rpro === 'RPRO-' || rpro.length < 8) {
        showFeedback(`❌ Mã sai định dạng: ${rpro}`, "text-red-600");
        playAudioFeedback(false);
        setTimeout(() => isProcessing = false, 1500);
        return;
    }

    try {
        const quantity = parseInt(inputQty.value) || 1;
        let finalNote = note || (manualNoteInput ? manualNoteInput.value.trim() : '');

        const insertRecord = {
            rpro,
            section: activeSection,
            action: activeAction,
            operator: 'User',
            quantity: quantity,
            note: finalNote,
            scan_date: new Date().toISOString().split('T')[0]
        };

        if (activeSection === 'Dán' && inputPuSheets) {
            const sheets = parseInt(inputPuSheets.value) || 0;
            if (sheets > 0) insertRecord.pu_sheets = sheets;
        }

        const { data: insertData, error: insertError } = await supabase
            .from('supplement_tracking')
            .insert([insertRecord])
            .select('id');

        if (insertError) throw insertError;

        lastRecordId = insertData[0].id;
        showFeedback(`✅ THÀNH CÔNG: ${rpro}`, "text-green-600 font-black");
        playAudioFeedback(true);
        addScanHistoryEntry(rpro, quantity, "SUCCESS", true, '', finalNote);

        undoContainer.classList.remove('hidden');
        if (manualNoteInput) manualNoteInput.value = "";
        if (inputQty) inputQty.value = "1";
        if (inputPuSheets) inputPuSheets.value = "1";

    } catch (err) {
        showFeedback("❌ Lỗi hệ thống: " + err.message, "text-red-600 text-sm");
        playAudioFeedback(false);
    } finally {
        if (!isInBatch) isProcessing = false;
    }
}

function finishProcessingBatch() {
    setTimeout(() => {
        isProcessing = false;
        scanFeedback.innerText = "Sẵn sàng cho mã tiếp theo...";
        scanFeedback.className = "mt-3 text-center min-h-[50px] font-bold text-lg text-gray-400";
    }, 2000);
}

function showToast(message, type = "success") {
    const existingToast = document.getElementById('floating-toast');
    if (existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.id = 'floating-toast';
    let baseClass = "fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-xl text-center min-w-[300px] animate-bounce-short transition-all duration-300 transform scale-100 opacity-100";
    toast.className = `${baseClass} ${type === "success" ? "bg-green-500" : "bg-red-600"} border-4 border-white`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function addScanHistoryEntry(rpro, qty, status, isSuccess, errorReason = '', noteText = '') {
    if (!scanHistoryContainer || !scanHistoryList) return;
    if (isSuccess) scanCountTotalVal++; else scanCountErrorVal++;
    updateStatsUI();
    scanHistoryContainer.classList.remove('hidden');
    const entry = document.createElement('div');
    entry.className = `flex justify-between items-center gap-2 p-1.5 rounded border ${isSuccess ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-rose-950/30 border-rose-900/50 text-rose-400'}`;
    entry.innerHTML = `<div class="flex flex-col flex-1 min-w-0"><div class="flex items-center gap-1.5"><span class="font-bold truncate text-sm">${rpro}</span></div></div>`;
    scanHistoryList.prepend(entry);
}

async function undoLastRecord() {
    if (!lastRecordId) return;
    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi vừa lưu?")) return;
    try {
        await supabase.from('supplement_tracking').delete().eq('id', lastRecordId);
        showFeedback("↩️ Đã xóa bản ghi vừa lưu!", "text-blue-600");
        lastRecordId = null;
        undoContainer.classList.add('hidden');
    } catch (err) { alert("Lỗi khi xóa: " + err.message); }
}

async function handleManualSave(forceSave = false) {
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

    const isAutoSave = autoSaveCheckbox ? autoSaveCheckbox.checked : false;

    showFeedback("🔍 Đang tìm thông tin đơn hàng...", "text-blue-500");
    await fetchDetails(val);

    if (!forceSave && !isAutoSave) {
        // Just fetched, do not save yet
        showFeedback(`✅ Đã tìm thấy: ${val}. Vui lòng kiểm tra và NHẤN LƯU!`, "text-blue-600");
        return;
    }

    const note = manualNoteInput ? manualNoteInput.value.trim() : '';
    await processRPRO(val, "MANUAL", note);
    manualRproInput.value = "";
}



function playAudioFeedback(success) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(success ? 880 : 220, audioContext.currentTime);
        osc.start();
        osc.stop(audioContext.currentTime + 0.2);
    } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
    sectionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sectionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSection = btn.dataset.section;
            activeSectionLabel.innerText = btn.innerText;

            if (puInfoContainer) puInfoContainer.classList.add('hidden');
            if (manualNoteInput) manualNoteInput.value = "";

            if (activeSection === 'Dán' || activeSection === 'Cắt') {
                activeAction = 'OUT';
                activeActionLabel.innerText = '⬆️ XUẤT ĐI (OUT)';
                actionContainer.classList.add('hidden');
                actionBtns.forEach(b => b.classList.remove('active'));
                scannerContainer.classList.remove('hidden');
                setTimeout(() => { if (manualRproInput) manualRproInput.focus(); }, 100);
            } else {
                actionContainer.classList.remove('hidden');
                activeAction = null;
                actionBtns.forEach(b => b.classList.remove('active'));
                scannerContainer.classList.add('hidden');
            }

            const rpro = manualRproInput ? manualRproInput.value.trim() : "";
            if (rpro) fetchDetails(rpro);
        });
    });

    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            actionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeAction = btn.dataset.action;
            activeActionLabel.innerText = btn.innerText;
            scannerContainer.classList.remove('hidden');

            if (activeSection === 'Dán' && puSheetsEdit && puSheetsDisplay) {
                puSheetsEdit.classList.remove('hidden');
                puSheetsDisplay.classList.add('hidden');
            }

            // Auto-focus on manual input so scanner works immediately
            setTimeout(() => { if (manualRproInput) manualRproInput.focus(); }, 100);
        });
    });

    const params = new URLSearchParams(window.location.search);
    const rproParam = params.get('rpro');
    if (rproParam) {
        manualRproInput.value = rproParam;
        showFeedback(`📍 Đã load đơn: ${rproParam}. Chọn Công đoạn & Hành động.`, "text-blue-600 font-bold bg-blue-50 p-2 rounded-lg border border-blue-200");

        sectionBtns.forEach(btn => btn.classList.add('animate-pulse', 'border-2', 'border-blue-400'));
        setTimeout(() => {
            sectionBtns.forEach(btn => btn.classList.remove('animate-pulse', 'border-2', 'border-blue-400'));
        }, 8000);
    }

    initAutoSave();
    updateStatsUI();
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
    btnSaveManual.addEventListener('click', () => handleManualSave(true));
}

if (btnQuickHbkd) {
    btnQuickHbkd.addEventListener('click', () => {
        if (manualNoteInput) {
            if (!manualNoteInput.value.includes("HBKD")) {
                manualNoteInput.value = (manualNoteInput.value ? "HBKD " + manualNoteInput.value : "HBKD");
            }
        }
    });
}

if (manualRproInput) {
    manualRproInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleManualSave(false);
        }
    });

    // Add event listener to fetch details when user types or paste code
    manualRproInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        if (val.length >= 8) fetchDetails(val);
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

// PU Sheets +/- buttons
if (btnIncSheets && inputPuSheets) {
    btnIncSheets.addEventListener('click', () => {
        inputPuSheets.value = parseInt(inputPuSheets.value) + 1;
    });
}
if (btnDecSheets && inputPuSheets) {
    btnDecSheets.addEventListener('click', () => {
        if (parseInt(inputPuSheets.value) > 1) {
            inputPuSheets.value = parseInt(inputPuSheets.value) - 1;
        }
    });
}

// ==================== FOCUS MANAGEMENT ====================
// Keep focus on manual input for zero-click scanning
setInterval(() => {
    // Only auto-focus if Camera is OFF to avoid conflicting with camera stream
    if (!cameraActive && activeSection && activeAction) {
        const activeElem = document.activeElement;
        const isForbidden = (
            activeElem === inputQty ||
            activeElem === manualNoteInput ||
            activeElem === batchRproTextarea ||
            activeElem === inputPuSheets
        );

        if (!isForbidden && activeElem !== manualRproInput) {
            manualRproInput.focus();
        }
        updateScannerStatusUI();
    }
}, 400);

function updateScannerStatusUI() {
    if (!handheldDot || !handheldStatusText) return;

    if (!activeSection || !activeAction) {
        handheldDot.className = "w-3 h-3 rounded-full bg-gray-400 flex-shrink-0";
        handheldStatusText.innerText = "Chọn Section & Action để bắt đầu";
        return;
    }

    const isFocused = (document.activeElement === manualRproInput);
    if (isFocused) {
        handheldDot.className = "w-3 h-3 rounded-full bg-green-500 animate-pulse flex-shrink-0";
        handheldStatusText.innerHTML = "<b class='text-green-600'>Sẵn sàng! Quét mã ngay không cần click.</b>";
    } else {
        const isEditing = (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        handheldDot.className = "w-3 h-3 rounded-full bg-amber-500 flex-shrink-0";
        handheldStatusText.innerText = isEditing ? "Đang nhập liệu khác, bấm ra ngoài để quay lại quét." : "Đang chờ focus...";
    }
}

function updateStatsUI() {
    if (scanCountTotalElem) scanCountTotalElem.textContent = scanCountTotalVal;
    if (scanCountErrorElem) scanCountErrorElem.textContent = scanCountErrorVal;
}

if (btnRefreshScanHistory) {
    btnRefreshScanHistory.addEventListener('click', () => {
        if (scanHistoryList) scanHistoryList.innerHTML = '';
        scanCountTotalVal = 0;
        scanCountErrorVal = 0;
        pendingBatchScans = [];
        btnSaveAllBatch.classList.add('hidden');
        updateStatsUI();
        if (scanHistoryContainer) scanHistoryContainer.classList.add('hidden');
        showFeedback("🔄 Đã làm mới danh sách theo dõi.", "text-blue-500");
    });
}

// Batch Import Listeners
if (importListCheckbox) {
    importListCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            batchInputContainer.classList.remove('hidden');
        } else {
            batchInputContainer.classList.add('hidden');
        }
    });
}

// HBKD List Mode Checkbox
if (hbkdListCheckbox) {
    hbkdListCheckbox.addEventListener('change', (e) => {
        isHbkdMode = e.target.checked;
        if (isHbkdMode) {
            // Auto-fill note with HBKD when mode is activated
            if (manualNoteInput && !manualNoteInput.value.includes('HBKD')) {
                manualNoteInput.value = manualNoteInput.value ? 'HBKD ' + manualNoteInput.value : 'HBKD';
            }
            showToast('🆘 Chế độ Scan HBKD đã BẬT - Mọi đơn sẽ tự ghi chú HBKD', 'success');
            console.log('🆘 HBKD mode ON');
        } else {
            showToast('🆘 Chế độ Scan HBKD đã TẮT', 'success');
            console.log('🆘 HBKD mode OFF');
        }
        // If both import-list and HBKD are checked, show batch input
        if (isHbkdMode && importListCheckbox?.checked) {
            batchInputContainer.classList.remove('hidden');
        }
    });
}

if (btnProcessBatch) {
    btnProcessBatch.addEventListener('click', handleBatchImport);
}

if (btnSaveAllBatch) {
    btnSaveAllBatch.addEventListener('click', saveBatchScans);
}

function showFeedback(msg, className) {
    if (!scanFeedback) return;
    scanFeedback.innerText = msg;
    scanFeedback.className = `mt-3 text-center min-h-[50px] font-bold text-lg ${className}`;
}

// ==================== BATCH IMPORT LOGIC ====================
async function handleBatchImport() {
    if (!activeSection || !activeAction) {
        showToast("⚠️ Vui lòng chọn bộ phận và hành động trước!", "error");
        return;
    }

    const text = batchRproTextarea.value.trim();
    if (!text) {
        showToast("⚠️ Vui lòng dán danh sách mã RPRO!", "error");
        return;
    }

    // Extract all RPRO codes using regex
    const rproMatches = text.match(/RPRO-?[\d-]+/gi) || [];
    if (rproMatches.length === 0) {
        showToast("❌ Không tìm thấy mã RPRO hợp lệ nào!", "error");
        return;
    }

    // Reset UI and internal state for batch
    if (scanHistoryList) scanHistoryList.innerHTML = '';
    scanCountTotalVal = 0;
    scanCountErrorVal = 0;
    updateStatsUI();
    pendingBatchScans = [];
    btnSaveAllBatch.classList.add('hidden');
    scanHistoryContainer.classList.remove('hidden');

    showFeedback(`⏳ Đang xử lý ${rproMatches.length} mã...`, "text-blue-600");
    showToast(`🔄 Đang phân tích ${rproMatches.length} đơn hàng...`, "success");

    for (const rawCode of rproMatches) {
        const code = normalizeRPRO(rawCode);

        const status = await fetchDetails(code);

        const item = {
            rpro: code,
            quantity: parseInt(inputQty.value) || 1,
            note: manualNoteInput.value.trim(),
            pu_sheets: (activeSection === 'Dán' && inputPuSheets) ? parseInt(inputPuSheets.value) : null,
            status: status
        };

        pendingBatchScans.push(item);
        addBatchScanHistoryEntry(item);

        await new Promise(r => setTimeout(r, 50));
    }

    if (pendingBatchScans.length > 0) {
        showFeedback(`✅ Đã phân tích xong ${pendingBatchScans.length} mã. Vui lòng kiểm tra và lưu.`, "text-green-600");
        btnSaveAllBatch.classList.remove('hidden');
        btnSaveAllBatch.innerText = `LƯU TẤT CẢ (${pendingBatchScans.length})`;
    } else {
        showFeedback("❌ Không có mã hợp lệ để xử lý.", "text-red-500");
    }
}

function addBatchScanHistoryEntry(item) {
    if (!scanHistoryList) return;

    const entry = document.createElement('div');
    const isSuccess = item.status === 'found';
    entry.className = `flex justify-between items-center gap-2 p-1.5 rounded border bg-blue-900/20 border-blue-800/50 text-blue-300`;

    const actionSymbol = activeAction === 'IN' ? '⬇️' : '⬆️';

    entry.innerHTML = `
        <div class="flex flex-col flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
                <span class="text-[9px] opacity-60 shrink-0">CHỜ LƯU</span>
                <span class="font-bold truncate text-sm leading-none">${item.rpro}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] mt-0.5 opacity-80">
                <span>${actionSymbol} ${activeSection}</span>
                <span class="bg-gray-800 px-1 rounded">SL: ${item.quantity}</span>
                ${item.note ? `<span class="italic text-yellow-300 truncate">📝 ${item.note}</span>` : ''}
                ${!isSuccess ? `<span class="italic text-orange-300 font-bold truncate">⚠️ Ko có data</span>` : `<span class="text-green-400 font-bold">OK</span>`}
            </div>
        </div>
    `;

    scanHistoryList.prepend(entry);
    scanCountTotalVal++;
    updateStatsUI();
}

async function saveBatchScans() {
    if (pendingBatchScans.length === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn lưu ${pendingBatchScans.length} đơn hàng này vào hệ thống?`)) return;

    btnSaveAllBatch.disabled = true;
    btnSaveAllBatch.innerText = "ĐANG LƯU...";
    showFeedback("⏳ Đang lưu dữ liệu vào hệ thống...", "text-blue-600");

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingBatchScans) {
        try {
            const insertRecord = {
                rpro: item.rpro,
                section: activeSection,
                action: activeAction,
                operator: 'User',
                quantity: item.quantity,
                note: item.note,
                scan_date: new Date().toISOString().split('T')[0]
            };

            if (item.pu_sheets) insertRecord.pu_sheets = item.pu_sheets;

            const { error } = await supabase.from('supplement_tracking').insert([insertRecord]);
            if (error) throw error;
            successCount++;
        } catch (err) {
            console.error(`Error saving ${item.rpro}:`, err);
            failCount++;
        }
    }

    showToast(`✅ Đã lưu ${successCount} đơn thành công! ${failCount > 0 ? `❌ Lỗi: ${failCount}` : ''}`, successCount > 0 ? "success" : "error");
    showFeedback(`✅ Hoàn tất: Lưu ${successCount} đơn thành công.`, "text-green-600");

    pendingBatchScans = [];
    btnSaveAllBatch.classList.add('hidden');
    batchRproTextarea.value = '';
}

// Khôi phục trạng thái checkbox tự động lưu
function initAutoSave() {
    if (autoSaveCheckbox) {
        const savedState = localStorage.getItem("supplement-count-auto-save");
        autoSaveCheckbox.checked = (savedState === "true");
        autoSaveCheckbox.addEventListener("change", (e) => {
            localStorage.setItem("supplement-count-auto-save", e.target.checked);
        });
    }
}

console.log("✅ Supplement Count Tracking Loaded");
