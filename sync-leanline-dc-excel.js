import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCEL_OUTPUT_PATH = path.join(__dirname, 'Leanline_DC_Surplus.xlsx');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let lastDataHash = '';

async function fetchLeanlineData() {
    const { data, error } = await supabase
        .from('surplusgoods')
        .select('*')
        .eq('section', 'LEANLINE_DC')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
}

async function lookupDescriptions(data) {
    const puCodes = [...new Set(data.map(i => i.pu_code || i.pu).filter(c => c))];
    const fbCodes = [...new Set(data.map(i => i.fb_code || i.fabric).filter(c => c))];
    
    const puMap = {};
    const fbMap = {};

    if (puCodes.length > 0) {
        try {
            const { data: paPu } = await supabase.from('powerapp').select('"PU", "PU DESCRIPTION"').in('PU', puCodes);
            if (paPu) paPu.forEach(r => { if (r.PU) puMap[r.PU] = r['PU DESCRIPTION']; });
            
            const missingPu = puCodes.filter(c => !puMap[c]);
            if (missingPu.length > 0) {
                const { data: mdPu } = await supabase.from('Masterdata').select('"PU", "PU DESCRIPTION"').in('PU', missingPu);
                if (mdPu) mdPu.forEach(r => { if (r.PU) puMap[r.PU] = r['PU DESCRIPTION']; });
            }
        } catch (e) {
            console.warn('PU metadata lookup failed:', e.message);
        }
    }

    if (fbCodes.length > 0) {
        try {
            const { data: paFb } = await supabase.from('powerapp').select('"FB", "FB DESCRIPTION"').in('FB', fbCodes);
            if (paFb) paFb.forEach(r => { if (r.FB) fbMap[r.FB] = r['FB DESCRIPTION']; });
            
            const missingFb = fbCodes.filter(c => !fbMap[c]);
            if (missingFb.length > 0) {
                const { data: mdFb } = await supabase.from('Masterdata').select('"FB", "FB DESCRIPTION"').in('FB', missingFb);
                if (mdFb) mdFb.forEach(r => { if (r.FB) fbMap[r.FB] = r['FB DESCRIPTION']; });
            }
        } catch (e) {
            console.warn('FB metadata lookup failed:', e.message);
        }
    }

    return { puMap, fbMap };
}

function calculateHash(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
}

async function writeExcel(data, puMap, fbMap, outputPath) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leanline_DC_Surplus');

    // Title styling
    worksheet.mergeCells('A1:AC1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BẢNG THEO DÕI HÀNG DƯ - LEANLINE DC';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0D9488' } // Teal 600
    };
    worksheet.getRow(1).height = 40;

    // Subtitle styling
    worksheet.mergeCells('A2:AC2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Tự động đồng bộ từ Supabase - Cập nhật lúc: ${new Date().toLocaleString('vi-VN')}`;
    subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Blank spacer row
    worksheet.getRow(3).height = 10;

    // Define standard size list
    const STANDARD_SIZES = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15];
    
    // Find all unique dynamic sizes
    const dynamicSizeKeys = new Set();
    data.forEach(item => {
        if (item.dynamic_sizes) {
            Object.keys(item.dynamic_sizes).forEach(k => {
                if (k) dynamicSizeKeys.add(k);
            });
        }
    });
    const sortedDynamicSizes = Array.from(dynamicSizeKeys).sort();

    // Define columns
    const columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Ngày Nhập', key: 'created_at', width: 22 },
        { header: 'MSNV Tác Động', key: 'msnv', width: 16 },
        { header: 'Mã RPRO', key: 'rpro', width: 18 },
        { header: 'Sales Order', key: 'so', width: 15 },
        { header: 'Brand', key: 'brand_code', width: 12 },
        { header: 'Mold', key: 'mold', width: 15 },
        { header: 'BOM', key: 'bom', width: 12 },
        { header: 'Code PU', key: 'pu_code', width: 10 },
        { header: 'Tên PU', key: 'pu_desc', width: 30 },
        { header: 'Code FB', key: 'fb_code', width: 10 },
        { header: 'Tên FB', key: 'fb_desc', width: 30 },
        { header: 'Section', key: 'section', width: 15 },
        { header: 'Ghi chú', key: 'note', width: 30 },
    ];

    // Append sizes to columns
    STANDARD_SIZES.forEach(sz => {
        columns.push({ header: `Size ${sz}`, key: `size_${sz.toString().replace('.', '_')}`, width: 9 });
    });
    sortedDynamicSizes.forEach(dsz => {
        columns.push({ header: `Size ${dsz} (Lạ)`, key: `dyn_${dsz}`, width: 12 });
    });

    columns.push({ header: 'Tổng số tấm/đôi', key: 'total_qty', width: 18 });

    // Set header row (row 4)
    const headerRowNumber = 4;
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.height = 28;

    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '14B8A6' } // Teal 500
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF0D9488' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };

        // Explicitly set the column width
        const column = worksheet.getColumn(i + 1);
        column.width = col.width;
    });

    // Populate rows
    data.forEach((item, index) => {
        const rowValues = [];
        rowValues.push(index + 1); // STT
        rowValues.push(new Date(item.created_at).toLocaleString('vi-VN'));
        rowValues.push(item.msnv || '');
        rowValues.push(item.rpro || '');
        rowValues.push(item.so || '');
        rowValues.push(item.brand_code || '');
        rowValues.push(item.mold || '');
        rowValues.push(item.bom || '');
        rowValues.push(item.pu_code || '');
        rowValues.push(puMap[item.pu_code || item.pu] || item.pu || '');
        rowValues.push(item.fb_code || '');
        rowValues.push(fbMap[item.fb_code || item.fabric] || item.fabric || '');
        rowValues.push(item.section || '');
        rowValues.push(item.note || '');

        // Standard sizes
        let total = 0;
        STANDARD_SIZES.forEach(sz => {
            const field = `size_${sz.toString().replace('.', '_')}`;
            const val = item[field] || 0;
            rowValues.push(val);
            if (!isNaN(val)) total += val;
        });

        // Dynamic sizes
        const dyn = item.dynamic_sizes || {};
        sortedDynamicSizes.forEach(dsz => {
            const val = dyn[dsz] || 0;
            rowValues.push(val);
            if (!isNaN(val)) total += val;
        });

        // Specific total rule for LEANLINE_DC
        if (item.section === 'LEANLINE_DC' && item.dynamic_sizes && item.dynamic_sizes['DC_Số_tấm_còn_lại'] !== undefined) {
            total = item.dynamic_sizes['DC_Số_tấm_còn_lại'] ?? 0;
        }

        rowValues.push(total);

        const row = worksheet.addRow(rowValues);
        row.height = 22;

        // Apply grid styling to cells
        row.eachCell((cell, colIndex) => {
            cell.font = { name: 'Segoe UI', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Left-align descriptive columns
            const leftAlignCols = [10, 12, 14]; // PU name, Fabric name, Ghi chú
            if (leftAlignCols.includes(colIndex)) {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }

            // Alternating backgrounds
            if (index % 2 === 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8FAFC' } // Slate 50
                };
            }
        });
    });

    try {
        await workbook.xlsx.writeFile(outputPath);
        console.log(`[${new Date().toLocaleTimeString()}] Excel updated successfully: ${outputPath}`);
    } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
            console.warn(`[${new Date().toLocaleTimeString()}] WARNING: File ${outputPath} is locked (possibly open in Excel). Retrying next run...`);
        } else {
            console.error('Error writing Excel file:', err);
        }
    }
}

async function runSync() {
    try {
        const data = await fetchLeanlineData();
        const dataHash = calculateHash(data);

        // Regenerate only when data content changes
        if (dataHash !== lastDataHash) {
            console.log(`[${new Date().toLocaleTimeString()}] Changes detected. Re-exporting...`);
            const { puMap, fbMap } = await lookupDescriptions(data);
            await writeExcel(data, puMap, fbMap, EXCEL_OUTPUT_PATH);
            lastDataHash = dataHash;
        }
    } catch (err) {
        console.error('Synchronization failed:', err.message);
    }
}

// Subscribe to Supabase Realtime changes
function startRealtimeSubscription() {
    console.log('📡 Subscribing to Supabase Realtime channel for surplusgoods...');
    supabase.channel('surplusgoods-changes-excel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'surplusgoods' },
            (payload) => {
                console.log(`[${new Date().toLocaleTimeString()}] Realtime change event received!`);
                runSync();
            }
        )
        .subscribe((status) => {
            console.log(`📡 Subscription status: ${status}`);
        });
}

// Main Execution
console.log('=====================================================');
console.log('    LEANLINE DC SURPLUS GOODS EXCEL SYNCHRONIZER     ');
console.log('=====================================================');
console.log(`Output: ${EXCEL_OUTPUT_PATH}`);
console.log(`Polling interval: every ${POLL_INTERVAL_MS / 1000} seconds`);

// Initial run
runSync();

// Start realtime updates and fallback interval polling
startRealtimeSubscription();
setInterval(runSync, POLL_INTERVAL_MS);
