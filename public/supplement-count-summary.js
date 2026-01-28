
import { supabase } from './supabaseClient.js';

const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const btnFilter = document.getElementById('btn-filter');
const summaryBody = document.getElementById('summary-body');

const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];

function setInitialDates() {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    dateFromInput.value = formattedDate;
    dateToInput.value = formattedDate;
}

async function loadSummary() {
    const from = dateFromInput.value;
    const to = dateToInput.value;

    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    summaryBody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400">Đang tải dữ liệu...</td></tr>';

    const { data, error } = await supabase
        .from('supplement_counting')
        .select('*')
        .gte('scan_date', from)
        .lte('scan_date', to)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Fetch error:", error);
        summaryBody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-500 font-bold">Lỗi: ' + error.message + '</td></tr>';
        return;
    }

    renderTable(data);
}

function renderTable(data) {
    // 1. Group by section
    const grouped = {};
    sections.forEach(s => {
        grouped[s] = data.filter(row => row.section === s).map(row => row.rpro);
    });

    // 2. Determine max rows needed
    const maxRows = Math.max(...sections.map(s => grouped[s].length));

    if (maxRows === 0) {
        summaryBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-gray-400 italic">Không có dữ liệu trong khoảng ngày này</td></tr>';
        sections.forEach(s => document.getElementById(`total-${s}`).innerText = '0');
        return;
    }

    // 3. Render body rows
    let html = '';
    for (let i = 0; i < maxRows; i++) {
        html += '<tr class="hover:bg-gray-50 transition">';
        sections.forEach((s, idx) => {
            const rpro = grouped[s][i] || '';
            const isLastCol = idx === sections.length - 1;
            html += `<td class="px-4 py-2 font-mono text-xs border-r ${isLastCol ? '' : 'border-r'} ${rpro ? 'text-gray-700' : ''}">${rpro}</td>`;
        });
        html += '</tr>';
    }
    summaryBody.innerHTML = html;

    // 4. Render footer totals
    sections.forEach(s => {
        const count = grouped[s].length;
        document.getElementById(`total-${s}`).innerText = count;

        // Highlight mismatch
        // (Optional: add comparison logic if needed)
    });
}

// Event Listeners
btnFilter.addEventListener('click', loadSummary);

document.addEventListener('DOMContentLoaded', () => {
    setInitialDates();
    loadSummary();
});
