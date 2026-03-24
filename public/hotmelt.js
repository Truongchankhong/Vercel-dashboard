import { supabase } from './supabaseClient.js';

// ==================== CONFIG & STATE ====================
let scanMode = 'IN'; // 'IN' or 'OUT'
let currentRproData = null;
let isProcessing = false;
let dashboardData = [];
let brandChart = null;

const ELEMENTS = {
    rproInput: document.getElementById('rpro-input'),
    qtyInput: document.getElementById('qty-input'),
    btnSave: document.getElementById('btn-save'),
    btnSaveText: document.getElementById('btn-save-text'),
    btnScanIn: document.getElementById('btn-scan-in'),
    btnScanOut: document.getElementById('btn-scan-out'),
    autoSave: document.getElementById('auto-save'),
    rproDetails: document.getElementById('rpro-details'),
    details: {
        brand: document.getElementById('detail-brand'),
        pu: document.getElementById('detail-pu'),
        fb: document.getElementById('detail-fb')
    },
    scanHistory: document.getElementById('scan-history'),
    sessionCount: document.getElementById('session-count'),
    inputLoader: document.getElementById('input-loader'),
    audio: {
        success: document.getElementById('audio-success'),
        error: document.getElementById('audio-error')
    },
    scannerOverlay: document.getElementById('scanner-input-overlay'),
    // Dashboard elements
    statWip: document.getElementById('stat-wip'),
    statTotalIn: document.getElementById('stat-total-in'),
    statTotalOut: document.getElementById('stat-total-out'),
    statCompletion: document.getElementById('stat-completion'),
    statCompletionBar: document.getElementById('stat-completion-bar'),
    tableBody: document.getElementById('dashboard-table-body'),
    tableSearch: document.getElementById('table-search'),
    brandFilter: document.getElementById('brand-filter'),
    dateRange: document.getElementById('date-range'),
    btnExport: document.getElementById('btn-export'),
    btnRefreshDashboard: document.getElementById('btn-refresh-dashboard')
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    ELEMENTS.rproInput.focus();
    setupEventListeners();
    updateSessionCount();
    
    // Auto-refresh history from DB
    fetchRecentHistory();
});

function setupEventListeners() {
    // Scan Mode Toggle
    window.setScanMode = (mode) => {
        scanMode = mode;
        ELEMENTS.btnScanIn.classList.toggle('bg-emerald-500', mode === 'IN');
        ELEMENTS.btnScanIn.classList.toggle('text-white', mode === 'IN');
        ELEMENTS.btnScanIn.classList.toggle('shadow-lg', mode === 'IN');
        ELEMENTS.btnScanIn.classList.toggle('text-slate-500', mode !== 'IN');
        ELEMENTS.btnScanIn.classList.toggle('bg-slate-100', mode !== 'IN');
        
        ELEMENTS.btnScanOut.classList.toggle('bg-rose-500', mode === 'OUT');
        ELEMENTS.btnScanOut.classList.toggle('text-white', mode === 'OUT');
        ELEMENTS.btnScanOut.classList.toggle('shadow-lg', mode === 'OUT');
        ELEMENTS.btnScanOut.classList.toggle('text-slate-500', mode !== 'OUT');
        ELEMENTS.btnScanOut.classList.toggle('bg-slate-100', mode !== 'OUT');
        
        ELEMENTS.btnSaveText.textContent = mode === 'IN' ? 'LƯU DỮ LIỆU (NHẬP)' : 'LƯU DỮ LIỆU (XUẤT)';
        ELEMENTS.rproInput.focus();
    };

    // Manual Input Handler
    let typingTimer;
    ELEMENTS.rproInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        clearTimeout(typingTimer);
        
        if (val.startsWith('RPRO-') && val.length >= 12) {
            typingTimer = setTimeout(() => handleRproDetected(val), 300);
        }
    });

    // Qty adjustments
    window.adjustQty = (delta) => {
        let val = parseInt(ELEMENTS.qtyInput.value) || 0;
        val = Math.max(1, val + delta);
        ELEMENTS.qtyInput.value = val;
    };

    // Save Button
    ELEMENTS.btnSave.addEventListener('click', () => {
        const rpro = ELEMENTS.rproInput.value.trim().toUpperCase();
        const qty = parseInt(ELEMENTS.qtyInput.value) || 1;
        if (rpro) performSave(rpro, qty);
    });

    // Enter key support
    ELEMENTS.rproInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const rpro = ELEMENTS.rproInput.value.trim().toUpperCase();
            const qty = parseInt(ELEMENTS.qtyInput.value) || 1;
            if (rpro) performSave(rpro, qty);
        }
    });

    // Dashboard Events
    window.addEventListener('dashboard-active', () => {
        refreshDashboard();
    });

    ELEMENTS.btnRefreshDashboard.addEventListener('click', refreshDashboard);
    ELEMENTS.btnExport.addEventListener('click', exportToExcel);
    ELEMENTS.tableSearch.addEventListener('input', renderTable);
    ELEMENTS.brandFilter.addEventListener('change', renderTable);
    ELEMENTS.dateRange.addEventListener('change', refreshDashboard);

    // Handheld Scanner Support
    let scanBuffer = '';
    let scanTimeout;
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' && document.activeElement !== ELEMENTS.scannerOverlay) return;

        clearTimeout(scanTimeout);
        if (e.key === 'Enter') {
            if (scanBuffer.length > 5) {
                handleRproDetected(scanBuffer);
                scanBuffer = '';
            }
        } else if (e.key.length === 1) {
            scanBuffer += e.key;
            scanTimeout = setTimeout(() => scanBuffer = '', 200);
        }
    });
}

// ==================== SCAN LOGIC ====================

async function handleRproDetected(rawRpro) {
    const rpro = normalizeRPRO(rawRpro);
    if (!rpro || isProcessing) return;
    
    isProcessing = true;
    ELEMENTS.inputLoader.classList.remove('hidden');
    ELEMENTS.rproInput.value = rpro;

    try {
        // Find in powerapp - Use column names exactly as they are in Supabase (quoted if needed)
        const { data, error } = await supabase
            .from('powerapp')
            .select('"Brand Code", PU, FB, "#MOLD", "Total Qty", "Finish date"')
            .eq('PRO ODER', rpro)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            // Map Brand Code to Brand for internal use
            data.Brand = data['Brand Code'];
            data.Mold = data['#MOLD'];
            
            currentRproData = data;
            showDetails(data);
            playAudio(true);
            
            // Auto Save if enabled
            if (ELEMENTS.autoSave.checked) {
                await performSave(rpro, parseInt(ELEMENTS.qtyInput.value) || 1);
            }
        } else {
            showToast(`⚠️ Không tìm thấy RPRO: ${rpro}`, 'error');
            playAudio(false);
            ELEMENTS.rproDetails.classList.add('hidden');
        }
    } catch (err) {
        console.error("Fetch error:", err);
        showToast("❌ Lỗi truy vấn dữ liệu", "error");
    } finally {
        isProcessing = false;
        ELEMENTS.inputLoader.classList.add('hidden');
    }
}

async function performSave(rpro, qty) {
    if (isProcessing) return;
    isProcessing = true;
    const saveBtn = ELEMENTS.btnSave;
    saveBtn.disabled = true;
    saveBtn.classList.add('opacity-50');

    try {
        const updateData = {};
        const now = new Date().toISOString();
        
        if (scanMode === 'IN') {
            updateData.hotmelt_scan_in = now;
            updateData.hotmelt_qty_in = qty;
        } else {
            updateData.hotmelt_scan_out = now;
            updateData.hotmelt_qty_out = qty;
        }

        // Add metadata from currentRproData if available
        if (currentRproData) {
            updateData.brand = currentRproData['Brand Code'] || currentRproData.Brand;
            updateData.pu = currentRproData.PU;
            updateData.fb = currentRproData.FB;
            updateData.mold = currentRproData['#MOLD'] || currentRproData.Mold;
            updateData.total_qty = currentRproData['Total Qty'];
            updateData.finish_date = currentRproData['Finish date'];
        }

        // Upsert based on RPRO
        const { error } = await supabase
            .from('Hotmelt')
            .upsert({ 
                rpro: rpro, 
                ...updateData,
                updated_at: now
            }, { onConflict: 'rpro' });

        if (error) throw error;

        showToast(`✅ Đã lưu ${scanMode === 'IN' ? 'NHẬP' : 'XUẤT'}: ${rpro}`, 'success');
        addHistoryRow(rpro, qty, scanMode);
        
        // Reset form
        ELEMENTS.rproInput.value = '';
        ELEMENTS.qtyInput.value = '1';
        ELEMENTS.rproInput.focus();
        currentRproData = null;
        
    } catch (err) {
        console.error("Save error:", err);
        showToast("❌ Lỗi khi lưu dữ liệu", "error");
    } finally {
        isProcessing = false;
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50');
    }
}

function normalizeRPRO(text) {
    let clean = text.trim().toUpperCase();
    if (clean.includes('|')) {
        const parts = clean.split('|');
        clean = parts.find(p => p.startsWith('RPRO')) || clean;
    }
    const match = clean.match(/RPRO-[\d-]+/);
    return match ? match[0] : clean;
}

// ==================== DASHBOARD LOGIC ====================

async function refreshDashboard() {
    try {
        let query = supabase.from('Hotmelt').select('*').order('updated_at', { ascending: false });
        
        // Date filters
        const range = ELEMENTS.dateRange.value;
        const now = new Date();
        if (range === 'today') {
            const startOfDay = new Date(now.setHours(0,0,0,0)).toISOString();
            query = query.gte('updated_at', startOfDay);
        } else if (range === 'yesterday') {
            const start = new Date(now.setDate(now.getDate() - 1));
            start.setHours(0,0,0,0);
            const end = new Date(start);
            end.setHours(23,59,59,999);
            query = query.gte('updated_at', start.toISOString()).lte('updated_at', end.toISOString());
        } else if (range === '7days') {
            const start = new Date(now.setDate(now.getDate() - 7)).toISOString();
            query = query.gte('updated_at', start);
        } else if (range === '30days') {
            const start = new Date(now.setDate(now.getDate() - 30)).toISOString();
            query = query.gte('updated_at', start);
        }

        const { data, error } = await query;
        if (error) throw error;

        dashboardData = data;
        updateStats();
        updateBrandFilter();
        renderTable();
        renderChart();
        
    } catch (err) {
        console.error("Dashboard error:", err);
        showToast("❌ Lỗi tải Dashboard", "error");
    }
}

function updateStats() {
    let totalIn = 0;
    let totalOut = 0;
    let wipCount = 0;

    dashboardData.forEach(row => {
        totalIn += (row.hotmelt_qty_in || 0);
        totalOut += (row.hotmelt_qty_out || 0);
        // WIP defined as has In but No Out time or Qty Out < Qty In
        if (row.hotmelt_scan_in && !row.hotmelt_scan_out) {
            wipCount++;
        }
    });

    ELEMENTS.statTotalIn.textContent = totalIn.toLocaleString();
    ELEMENTS.statTotalOut.textContent = totalOut.toLocaleString();
    ELEMENTS.statWip.textContent = wipCount.toLocaleString();
    
    const rate = totalIn > 0 ? Math.round((totalOut / totalIn) * 100) : 0;
    ELEMENTS.statCompletion.textContent = rate + '%';
    ELEMENTS.statCompletionBar.style.width = rate + '%';
}

function renderTable() {
    const searchTerm = ELEMENTS.tableSearch.value.toLowerCase();
    const brandFilter = ELEMENTS.brandFilter.value;
    
    const filtered = dashboardData.filter(row => {
        const matchesRpro = row.rpro.toLowerCase().includes(searchTerm);
        const matchesBrand = brandFilter === 'all' || row.brand === brandFilter;
        return matchesRpro && matchesBrand;
    });

    ELEMENTS.tableBody.innerHTML = filtered.map((row, idx) => {
        const isWip = row.hotmelt_scan_in && !row.hotmelt_scan_out;
        return `
            <tr class="hover:bg-slate-50 transition ${isWip ? 'bg-orange-50/30' : ''}">
                <td class="px-6 py-4 text-xs font-black text-slate-300">#${String(idx + 1).padStart(3, '0')}</td>
                <td class="px-6 py-4">
                    <div class="font-black text-slate-800">${row.rpro}</div>
                    <div class="text-[10px] text-slate-400 uppercase">${row.pu || 'N/A'}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs font-bold text-slate-700">${row.mold || '---'}</div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black">${row.brand || '---'}</span>
                </td>
                <td class="px-6 py-4 text-center font-black text-slate-400">${row.total_qty || '0'}</td>
                <td class="px-6 py-4">
                    <div class="text-xs font-bold">${formatTime(row.hotmelt_scan_in)}</div>
                    <div class="text-[10px] text-slate-400">${formatDate(row.hotmelt_scan_in)}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs font-bold">${formatTime(row.hotmelt_scan_out)}</div>
                    <div class="text-[10px] text-slate-400">${formatDate(row.hotmelt_scan_out)}</div>
                </td>
                <td class="px-6 py-4 bg-emerald-50/50 text-emerald-600 font-black text-center">${row.hotmelt_qty_in || 0}</td>
                <td class="px-6 py-4 bg-rose-50/50 text-rose-600 font-black text-center">${row.hotmelt_qty_out || 0}</td>
                <td class="px-6 py-4 text-center font-bold text-slate-500">${row.dc || '---'}</td>
                <td class="px-6 py-4 text-center text-xs text-slate-400">${row.finish_date ? formatDate(row.finish_date) : '---'}</td>
            </tr>
        `;
    }).join('');
}

function renderStatusBadge(row) {
    if (row.hotmelt_scan_in && row.hotmelt_scan_out) {
        return `<span class="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black italic">FINISHED</span>`;
    } else if (row.hotmelt_scan_in) {
        return `<span class="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-[10px] font-black animate-pulse uppercase">In Progress</span>`;
    }
    return `<span class="text-slate-200">---</span>`;
}

function renderChart() {
    const brandCounts = {};
    dashboardData.forEach(row => {
        if (row.brand) {
            brandCounts[row.brand] = (brandCounts[row.brand] || 0) + 1;
        }
    });

    const labels = Object.keys(brandCounts).sort((a,b) => brandCounts[b] - brandCounts[a]).slice(0, 5);
    const data = labels.map(l => brandCounts[l]);

    if (brandChart) brandChart.destroy();

    const ctx = document.getElementById('brandChart').getContext('2d');
    brandChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số đơn hàng',
                data: data,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(59, 130, 246, 0.8)'
                ],
                borderRadius: 12,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateBrandFilter() {
    const brands = [...new Set(dashboardData.map(r => r.brand).filter(Boolean))];
    ELEMENTS.brandFilter.innerHTML = '<option value="all">Tất cả Brand</option>' + 
        brands.map(b => `<option value="${b}">${b}</option>`).join('');
}

// ==================== UTILS ====================

function showDetails(data) {
    ELEMENTS.details.brand.textContent = data.Brand || '---';
    ELEMENTS.details.pu.textContent = data.PU || '---';
    ELEMENTS.details.fb.textContent = data.FB || '---';
    ELEMENTS.rproDetails.classList.remove('hidden');
    ELEMENTS.rproDetails.classList.add('animate__fadeInRight');
}

function addHistoryRow(rpro, qty, mode) {
    const row = document.createElement('div');
    row.className = `flex justify-between items-center bg-white p-4 rounded-2xl border-l-4 shadow-sm animate__animated animate__slideInRight ${mode === 'IN' ? 'border-emerald-500' : 'border-rose-500'}`;
    
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    
    row.innerHTML = `
        <div class="flex flex-col">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${time} - ${mode}</span>
            <span class="text-sm font-black text-slate-800">${rpro}</span>
        </div>
        <div class="flex items-center gap-3">
            <div class="px-3 py-1 bg-slate-100 rounded-lg text-xs font-black">SL: ${qty}</div>
            <div class="w-8 h-8 flex items-center justify-center rounded-full ${mode === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
        </div>
    `;
    
    if (ELEMENTS.scanHistory.firstChild && ELEMENTS.scanHistory.firstChild.innerText && ELEMENTS.scanHistory.firstChild.innerText.includes('Chưa có dữ liệu')) {
        ELEMENTS.scanHistory.innerHTML = '';
    }
    
    ELEMENTS.scanHistory.prepend(row);
    updateSessionCount();
}

async function fetchRecentHistory() {
    try {
        const { data } = await supabase
            .from('Hotmelt')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(10);
            
        if (data && data.length > 0) {
            ELEMENTS.scanHistory.innerHTML = '';
            data.forEach(item => {
                const mode = item.hotmelt_scan_out ? 'OUT' : 'IN';
                const qty = mode === 'IN' ? (item.hotmelt_qty_in || 1) : (item.hotmelt_qty_out || 1);
                addHistoryRow(item.rpro, qty, mode);
            });
        }
    } catch (e) {}
}

function updateSessionCount() {
    const count = ELEMENTS.scanHistory.children.length;
    ELEMENTS.sessionCount.textContent = count;
}

function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.className = `fixed top-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl text-white font-black text-lg animate__animated animate__bounceIn border-4 border-white ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('animate__bounceIn', 'animate__fadeOutUp');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function playAudio(isSuccess) {
    if (isSuccess) ELEMENTS.audio.success.play();
    else ELEMENTS.audio.error.play();
}

function formatTime(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(dashboardData.map(row => ({
        "PRO ORDER": row.rpro,
        "Brand": row.brand,
        "PU Code": row.pu,
        "FB": row.fb,
        "Hotmelt Scan In": row.hotmelt_scan_in,
        "Hotmelt Scan Out": row.hotmelt_scan_out,
        "Qty In": row.hotmelt_qty_in,
        "Qty Out": row.hotmelt_qty_out,
        "Created At": row.created_at
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hotmelt Tracking");
    XLSX.writeFile(wb, `Hotmelt_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
