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
const handheldStatusBox = document.getElementById('handheld-status-box');
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
let isHbkdMode = false; // HBKD list scan mode
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

let scanQueue = []; // New: Queue for rapid scanning
let isQueueProcessing = false;

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

async function onCameraScanSuccess(decodedText) {
    if (isProcessing) return;

    const rproMatches = decodedText.match(/RPRO-[\d-]+/g);
    if (rproMatches && rproMatches.length > 1) {
        showMultiRproConfirmation(rproMatches, "CAMERA", "");
    } else {
        const code = (rproMatches && rproMatches.length === 1) ? rproMatches[0] : decodedText.trim().toUpperCase();
        if (!code) return;

        // Chỉ load lên giao diện, không lưu tự động
        if (manualRproInput) manualRproInput.value = code;
        const status = await fetchDetails(code);

        // TỰ ĐỘNG TẮT CAMERA SAU KHI QUÉT THÀNH CÔNG
        stopCamera();

        if (status === 'found') {
            showFeedback(`✅ Đã nhận mã ${code} (Có dữ liệu).`, "text-green-600 font-bold bg-green-50 p-2 rounded-lg border-2 border-green-200");
        } else {
            showFeedback(`⚠️ Đơn ${code}: Không có thông tin trên server.`, "text-orange-600 bg-orange-50 p-2 rounded-lg border-2 border-orange-200");
        }

        playAudioFeedback(status === 'found');

        // 🚀 TỰ ĐỘNG LƯU (Cả trường hợp có hay không có dữ liệu đều lưu)
        if (autoSaveCheckbox?.checked || isHbkdMode) {
            if (isHbkdMode && manualNoteInput && !manualNoteInput.value.includes('HBKD')) {
                manualNoteInput.value = manualNoteInput.value ? 'HBKD ' + manualNoteInput.value : 'HBKD';
            }
            console.log(`🚀 Tự động lưu đang bật (${status === 'found' ? 'Có data' : 'Không data'})${isHbkdMode ? ' [HBKD]' : ''}...`);
            setTimeout(() => handleManualSave(), 800);
        }
    }
}

// ==================== HANDHELD SCANNER ====================
// -------------------- SCANNER HANDLERS --------------------
// Most reliable method: Focus the actual manual input field
function processScannerBuffer(text) {
    const code = text.trim();
    if (!code) return;
    // Handled by manualRproInput events
}

// Global keydown listener for fallback/Enter
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (document.activeElement === manualRproInput) {
            e.preventDefault();
            handleManualSave();
        }
    }
});

function normalizeRPRO(text) {
    if (!text) return "";
    let clean = text.trim().toUpperCase();

    // Parse QR if pipe-delimited
    if (clean.includes('|')) {
        const parts = clean.split('|');
        const found = parts.find(p => p.trim().startsWith('RPRO'));
        if (found) clean = found.trim();
    }

    // Remove all variants of RPRO prefix and clean
    clean = clean.replace(/^RPRO-+/i, '').replace(/^RPRO/i, '');
    clean = clean.replace(/[^A-Z0-9-]/g, '');

    // Ensure standard RPRO-XXXXXX-XXXX format if possible
    const pureNumbers = clean.replace(/-/g, '');
    if (pureNumbers.length >= 7) {
        return `RPRO-${pureNumbers.substring(0, 6)}-${pureNumbers.substring(6)}`;
    }
    return "RPRO-" + clean.replace(/-+/g, '-');
}

// ==================== AUTO-FETCH NOTE & QUANTITY ====================
async function fetchDetails(rawRpro) {
    const rpro = normalizeRPRO(rawRpro);
    if (!rpro || rpro === 'RPRO-' || !activeSection) return false;

    // Simple RPRO pattern check
    if (rpro.length < 5) return false;

    let foundAnyData = false;
    try {
        console.log(`ℹ️ Fetching info for ${rpro}...`);
        
        // 2. Fetch Default Quantity
        let defaultQty = 1;

        if (activeSection === 'Dán') {
            // "Số đôi có thể bù trong trang Bù hàng- Xác nhận" -> available_supplement in supplement_confirm
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
                console.log(`📦 Dán: Default quantity from supplement_confirm: ${defaultQty}, So Tam: ${confirmSoTam}`);
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
            if (defaultQty > 1 || (confirmData && confirmData.length > 0)) foundAnyData = true;

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
            if (puCode) foundAnyData = true;

            // Display PU code
            if (puInfoContainer && puCodeDisplay) {
                puInfoContainer.classList.remove('hidden');
                puCodeDisplay.textContent = puCode || 'Không tìm thấy thông tin';
                puCodeDisplay.className = puCode
                    ? 'text-center text-lg font-black text-teal-800'
                    : 'text-center text-sm font-semibold text-gray-400 italic';
            }

            // === PU SHEETS ===
            if (puSheetsEdit) puSheetsEdit.classList.remove('hidden');
            if (puSheetsDisplay) puSheetsDisplay.classList.add('hidden');

            if (confirmSoTam !== null && confirmSoTam !== undefined) {
                // Priority 1: From supplement_confirm
                if (inputPuSheets) inputPuSheets.value = confirmSoTam;
                console.log(`📐 PU sheets from supplement_confirm: ${confirmSoTam}`);
            } else {
                // Priority 2: Fallback to last saved in supplement_tracking
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
                    console.log(`📐 PU sheets fallback (last scan): ${sheetsData[0].pu_sheets}`);
                } else {
                    if (inputPuSheets) inputPuSheets.value = 1;
                }
            }
        } else if (['Cắt', 'Molding', 'DC', 'Molded'].includes(activeSection)) {
            // Hide PU info for non-Dán sections
            if (puInfoContainer) puInfoContainer.classList.add('hidden');

            // NEW: Cascading fallback for quantity (Look through all possible previous sections)
            // Sequence: Dán -> Cắt -> Molding -> DC -> Molded
            const stagesToSearch = [];
            if (activeSection === 'Cắt') stagesToSearch.push('Dán');
            if (activeSection === 'Molding') stagesToSearch.push('Cắt', 'Dán');
            if (activeSection === 'DC') stagesToSearch.push('Molding', 'Cắt', 'Dán');
            if (activeSection === 'Molded') stagesToSearch.push('Molding', 'Cắt', 'Dán');

            let qtyFromPrev = null;
            let foundInStage = null;

            // 1. Try to find the latest OUT record from any previous stage
            for (const stage of stagesToSearch) {
                console.log(`🔍 Seeking OUT record from ${stage} as default for ${activeSection}...`);
                const { data: prevOut } = await supabase
                    .from('supplement_tracking')
                    .select('quantity')
                    .eq('rpro', rpro)
                    .eq('section', stage)
                    .eq('action', 'OUT')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (prevOut && prevOut.length > 0 && prevOut[0].quantity > 0) {
                    // Critical Fix: If we find a quantity > 1, we definitely take it.
                    // If we find 1, we keep looking just in case there's a better one in an earlier stage (optional, but safer)
                    if (prevOut[0].quantity > 1) {
                        qtyFromPrev = prevOut[0].quantity;
                        foundInStage = stage;
                        console.log(`✅ ${activeSection}: Found quantity ${qtyFromPrev} from ${stage}`);
                        break;
                    } else if (qtyFromPrev === null) {
                        qtyFromPrev = prevOut[0].quantity;
                        foundInStage = stage;
                    }
                }
            }

            if (qtyFromPrev !== null) {
                defaultQty = qtyFromPrev;
                foundAnyData = true;
                console.log(`✅ ${activeSection}: Mặc định lấy SL Scan OUT của ${foundInStage}: ${defaultQty}`);
            } else {
                console.warn(`⚠️ Không tìm thấy bản ghi Scan OUT ở bất kỳ công đoạn trước nào cho ${rpro}`);
                // Fallback to absolute last scan of any action across ALL sections
                const { data: lastAny } = await supabase
                    .from('supplement_tracking')
                    .select('quantity, section')
                    .eq('rpro', rpro)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (lastAny && lastAny.length > 0 && lastAny[0].quantity > 0) {
                    defaultQty = lastAny[0].quantity;
                    foundAnyData = true;
                    console.log(`✅ Fallback to last absolute scan (${lastAny[0].section}) quantity: ${defaultQty}`);
                }
            }

            // FINAL FALLBACK: If still 1 or no data found above, try supplement_confirm
            // We only do this if we haven't found a strong quantity (>1) yet
            if (defaultQty <= 1) {
                const { data: confirmData } = await supabase
                    .from('supplement_confirm')
                    .select('available_supplement, total')
                    .eq('rpro', rpro)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (confirmData && confirmData.length > 0) {
                    const rec = confirmData[0];
                    const confirmQty = (rec.available_supplement !== null) ? rec.available_supplement : rec.total;
                    if (confirmQty > 0) {
                        defaultQty = confirmQty;
                        foundAnyData = true;
                        console.log(`📦 Fallback to supplement_confirm total: ${defaultQty}`);
                    }
                }
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
    return foundAnyData ? 'found' : 'not_found';
}

// ==================== BATCH PROCESSING MODAL ====================
function showMultiRproConfirmation(matches, mode, note) {
    isProcessing = true; // Lock scanning
    multiRproCount.textContent = matches.length;
    multiRproModal.classList.remove('hidden');

    // Button: Tiếp tục
    btnMultiContinue.onclick = async () => {
        multiRproModal.classList.add('hidden');
        showFeedback(`⏳ Đang xử lý ${matches.length} mã...`, "text-blue-600");

        for (const code of matches) {
            await fetchDetails(code);
            await processRPRO(code, mode, note, true);
        }
        finishProcessingBatch();
    };

    // Button: Đơn chùm (Chỉ lấy mã đầu tiên)
    btnMultiGroup.onclick = async () => {
        multiRproModal.classList.add('hidden');
        isProcessing = false;
        const firstRpro = matches[0];

        showFeedback(`📦 Đơn chùm: Đã chọn mã đại diện ${firstRpro}`, "text-blue-600");
        if (manualRproInput) manualRproInput.value = firstRpro;

        await fetchDetails(firstRpro);
        playAudioFeedback(true);
    };

    // Button: Scan lại
    btnMultiRescan.onclick = () => {
        multiRproModal.classList.add('hidden');
        isProcessing = false;
        showFeedback("🔄 Vui lòng scan lại từng mã chậm lại.", "text-gray-500");
        playAudioFeedback(false);
    };
}
async function processRPRO(text, mode, note = '', isInBatch = false) {
    const rpro = normalizeRPRO(text);
    console.log(`🚀 Processing RPRO: ${rpro} | Mode: ${mode} | Note: ${note} | Section: ${activeSection} | Action: ${activeAction}`);

    if (!isInBatch) isProcessing = true;

    if (rpro === 'RPRO-' || rpro.length < 8) {
        const errorMsg = `❌ Mã sai định dạng: ${rpro}`;
        showFeedback(errorMsg, "text-red-600");
        showToast(errorMsg, "error");
        playAudioFeedback(false);
        addScanHistoryEntry(rpro, 0, "ERROR", false, "Mã sai định dạng");
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

        // 2. NEW: Validation Stage Sequence (Cascading flow check)
        const stagesToSearch = [];
        if (activeSection === 'Cắt') stagesToSearch.push('Dán');
        if (activeSection === 'Molding') stagesToSearch.push('Cắt', 'Dán');
        if (activeSection === 'DC') stagesToSearch.push('Molding', 'Cắt', 'Dán');
        if (activeSection === 'Molded') stagesToSearch.push('Molding', 'Cắt', 'Dán');

        if (stagesToSearch.length > 0) {
            console.log(`🛡️ Flow Guard: Checking if any stage ${stagesToSearch.join('/')} has Scan OUT for ${rpro}...`);
            const { data: anyPrevOut, error: prevErr } = await supabase
                .from('supplement_tracking')
                .select('section')
                .eq('rpro', rpro)
                .in('section', stagesToSearch)
                .eq('action', 'OUT')
                .limit(1);

            if (prevErr) throw prevErr;

            if (!anyPrevOut || anyPrevOut.length === 0) {
                const errorMsg = `❌ Lỗi: Phải Scan OUT ít nhất một công đoạn trước (${stagesToSearch.join(', ')})!`;
                showFeedback(errorMsg, "text-red-700 bg-red-50 p-3 rounded-xl border-2 border-red-200 animate-pulse");
                showToast(errorMsg, "error");
                playAudioFeedback(false);
                addScanHistoryEntry(rpro, 1, "MISSING_PREV", false, `Thiếu Scan Out các trạm trước`);
                if (!isInBatch) isProcessing = false;
                return;
            }
            console.log(`✅ Flow Guard passed: Found Scan OUT for ${anyPrevOut[0].section}.`);
        }

        const quantity = parseInt(inputQty.value) || 1;
        if (quantity < 1) {
            const errorMsg = "⚠️ Số lượng phải lớn hơn 0!";
            showFeedback(errorMsg, "text-red-500 font-bold");
            showToast(errorMsg, "error");
            playAudioFeedback(false);
            addScanHistoryEntry(rpro, 0, "QTY_INVALID", false, "Số lượng rỗng");
            isProcessing = false;
            return;
        }

        console.log("💾 Inserting new record...");
        // 3. Save to Supabase
        let finalNote = note || (manualNoteInput ? manualNoteInput.value.trim() : '');

        // Build insert record
        const insertRecord = {
            rpro,
            section: activeSection,
            action: activeAction,
            operator: 'User',
            quantity: quantity,
            note: finalNote,
            scan_date: new Date().toISOString().split('T')[0]
        };

        // Add pu_sheets for Dán section (OUT only now)
        if (activeSection === 'Dán' && inputPuSheets) {
            const sheets = parseInt(inputPuSheets.value) || 0;
            if (sheets > 0) insertRecord.pu_sheets = sheets;
        }

        const { data: insertData, error: insertError } = await supabase
            .from('supplement_tracking')
            .insert([insertRecord])
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
        addScanHistoryEntry(rpro, quantity, "SUCCESS", true, '', finalNote);

        undoContainer.classList.remove('hidden');

        // Clear note input after successful save
        if (manualNoteInput) manualNoteInput.value = "";
        if (inputQty) inputQty.value = "1"; // Reset Qty to 1 for next scan
        if (inputPuSheets) inputPuSheets.value = "1"; // Reset PU sheets

    } catch (err) {
        console.error("❌ System Error:", err);
        const errorMsg = "❌ Lỗi hệ thống: " + err.message;
        showFeedback(errorMsg, "text-red-600 text-sm");
        showToast(errorMsg, "error");
        playAudioFeedback(false);
        addScanHistoryEntry(rpro, 0, "SYS_ERROR", false, err.message);
    } finally {
        if (!isInBatch) {
            isProcessing = false;
        }
    }
}

// NEW: Queue Worker
async function processQueue() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;

    while (scanQueue.length > 0) {
        const item = scanQueue.shift();
        const { code, mode } = item;

        console.log(`⚙️ Processing from queue (${scanQueue.length} left): ${code}`);

        // Load to UI for visual feedback
        if (manualRproInput) manualRproInput.value = code;

        const status = await fetchDetails(code);

        if (status === 'found') {
            showFeedback(`✅ Quét nhanh: ${code}`, "text-green-600 font-bold");
        } else {
            showFeedback(`⚠️ Đơn ${code}: Không có data`, "text-orange-600");
        }

        playAudioFeedback(status === 'found');

        // Auto Save if enabled OR HBKD mode is on (auto-save for HBKD)
        if (autoSaveCheckbox?.checked || isHbkdMode) {
            const hbkdNote = isHbkdMode ? 'HBKD' : '';
            await processRPRO(code, mode, hbkdNote, false);
        }

        // Small delay between rows to allow DB to breathe
        await new Promise(r => setTimeout(r, 100));
    }

    isQueueProcessing = false;
    finishProcessingBatch(); // Clean up UI after queue is empty
}

function finishProcessingBatch() {
    setTimeout(() => {
        isProcessing = false;
        if (scanFeedback.innerText.includes("✅")) {
            scanFeedback.innerText = "Sẵn sàng cho mã tiếp theo...";
            scanFeedback.className = "mt-3 text-center min-h-[50px] font-bold text-lg text-gray-400";
        }
    }, 2000);
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

// ==================== SCAN HISTORY HANDLER ====================
function addScanHistoryEntry(rpro, qty, status, isSuccess, errorReason = '', noteText = '') {
    if (!scanHistoryContainer || !scanHistoryList) return;

    // Increment counters
    if (isSuccess) {
        scanCountTotalVal++;
    } else {
        scanCountErrorVal++;
    }
    updateStatsUI();

    // Show container on first entry
    scanHistoryContainer.classList.remove('hidden');

    const entry = document.createElement('div');
    entry.className = `flex justify-between items-center gap-2 p-1.5 rounded border ${isSuccess ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-rose-950/30 border-rose-900/50 text-rose-400'}`;

    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const actionSymbol = activeAction === 'IN' ? '⬇️' : '⬆️';
    const hasHbkd = noteText && noteText.includes('HBKD');
    const hbkdBadge = hasHbkd ? `<span class="bg-amber-600 text-white px-1.5 rounded text-[9px] font-black">🆘 HBKD</span>` : '';

    entry.innerHTML = `
        <div class="flex flex-col flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
                <span class="text-[9px] opacity-60 shrink-0">${time}</span>
                <span class="font-bold truncate text-sm leading-none">${rpro}</span>
                ${hbkdBadge}
            </div>
            <div class="flex items-center gap-2 text-[10px] mt-0.5 opacity-80">
                <span>${actionSymbol} ${activeSection}</span>
                <span class="bg-gray-800 px-1 rounded">SL: ${qty}</span>
                ${!isSuccess ? `<span class="italic text-rose-300 font-bold truncate">⚠️ ${errorReason}</span>` : `<span class="bg-emerald-800/50 px-1 rounded text-[8px]">OK</span>`}
            </div>
        </div>
    `;

    // Prepend to top
    scanHistoryList.prepend(entry);

    // Keep only last 50 entries
    if (scanHistoryList.children.length > 50) {
        scanHistoryList.lastElementChild.remove();
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
            status: status,
            isHbkd: isHbkdMode
        };

        pendingBatchScans.push(item);
        addBatchScanHistoryEntry(item);

        // Small delay to keep UI responsive
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
    const hasHbkd = item.note && item.note.includes('HBKD');
    entry.className = `flex justify-between items-center gap-2 p-1.5 rounded border ${hasHbkd ? 'bg-amber-900/20 border-amber-800/50 text-amber-300' : 'bg-blue-900/20 border-blue-800/50 text-blue-300'}`;

    const actionSymbol = activeAction === 'IN' ? '⬇️' : '⬆️';
    const hbkdBadge = hasHbkd ? `<span class="bg-amber-600 text-white px-1.5 rounded text-[9px] font-black">🆘 HBKD</span>` : '';

    entry.innerHTML = `
        <div class="flex flex-col flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
                <span class="text-[9px] opacity-60 shrink-0">CHỜ LƯU</span>
                <span class="font-bold truncate text-sm leading-none">${item.rpro}</span>
                ${hbkdBadge}
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

    if (importListCheckbox) {
        importListCheckbox.checked = false;
        batchInputContainer.classList.add('hidden');
    }
    if (hbkdListCheckbox) {
        hbkdListCheckbox.checked = false;
        isHbkdMode = false;
    }
    if (manualNoteInput) manualNoteInput.value = '';
}

function initAutoSave() {
    if (autoSaveCheckbox) {
        const savedState = localStorage.getItem("supplement-count-auto-save");
        autoSaveCheckbox.checked = (savedState === "true");
        autoSaveCheckbox.addEventListener("change", (e) => {
            localStorage.setItem("supplement-count-auto-save", e.target.checked);
        });
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

// ==================== INITIALIZATION & EVENT LISTENERS ====================
window.addEventListener('DOMContentLoaded', () => {
    sectionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sectionBtns.forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
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
        });
    });

    const params = new URLSearchParams(window.location.search);
    const rproParam = params.get('rpro');
    if (rproParam) {
        manualRproInput.value = rproParam;
        showFeedback(`📍 Đã load đơn: ${rproParam}. Vui lòng F5 trang nếu máy quét không nhận diện.`, "text-blue-600 font-bold bg-blue-50 p-2 rounded-lg border border-blue-200");
    }

    if (manualRproInput) {
        // Essential for physical scanners that send ENTER
        manualRproInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleManualSave();
            }
        });

        // Instant fetch info when scanner types
        manualRproInput.addEventListener('input', (e) => {
            const val = e.target.value.trim().toUpperCase();
            if (val.length >= 8) fetchDetails(val);
        });
    }

    // 4. Strong Focus: Focus the manual input box directly
    document.addEventListener('click', (e) => {
        if (!activeSection || !activeAction) return;

        const tag = e.target.tagName;
        const isInteractive = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || e.target.closest('button'));

        if (!isInteractive) {
            if (manualRproInput) {
                console.log("🎯 Auto-focusing manual input...");
                manualRproInput.focus();
                updateScannerStatusUI();
            }
        }
    });

    // Handle clicking on the status box explicitly
    if (handheldStatusBox) {
        handheldStatusBox.addEventListener('click', (e) => {
            if (scannerInputOverlay) {
                scannerInputOverlay.focus();
                updateScannerStatusUI();
                showToast("🎯 Đã kích hoạt máy quét!", "success");
            }
        });
    }

    // 5. Initialize components
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
    btnSaveManual.addEventListener('click', handleManualSave);
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
    // Ensure Enter key triggers save
    manualRproInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleManualSave();
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
// Keep focus on manual input for handheld scanner
setInterval(() => {
    // Only auto-focus if Camera is OFF (to prevent mobile keyboard pop-up on wrong screens)
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
    if (!handheldStatusBox || !handheldDot || !handheldStatusText) return;

    if (!activeSection || !activeAction) {
        handheldDot.className = "w-3 h-3 rounded-full bg-gray-400";
        handheldStatusText.innerText = "Chọn Section/Action...";
        handheldStatusBox.className = "p-4 scanner-status-inactive border rounded-lg mb-4";
        return;
    }

    const isFocused = (document.activeElement === manualRproInput);

    if (isFocused) {
        handheldDot.className = "w-3 h-3 rounded-full bg-green-500 animate-pulse";
        handheldStatusText.innerText = "Sẵn sàng quét!";
        handheldStatusText.className = "text-green-600 font-bold";
        handheldStatusBox.className = "p-4 scanner-status-active border rounded-lg mb-4 bg-green-50 border-green-200";
    } else {
        const isEditing = (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        handheldDot.className = "w-3 h-3 rounded-full bg-amber-500";
        handheldStatusText.innerText = isEditing ? "Đang nhập liệu khác..." : "Đang chờ focus...";
        handheldStatusText.className = "text-amber-600";
        handheldStatusBox.className = "p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4";
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


console.log("✅ Supplement Count Tracking Loaded");
