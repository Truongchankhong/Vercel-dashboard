
import { supabase } from './supabaseClient.js';

const listBody = document.getElementById('list-body');
const dateStartInput = document.getElementById('date-start');
const dateEndInput = document.getElementById('date-end');
const searchInput = document.getElementById('search-input');
const btnRefresh = document.getElementById('btn-refresh');

function initDates() {
    const today = new Date();
    const lastThreeDays = new Date();
    lastThreeDays.setDate(today.getDate() - 3);

    dateEndInput.value = today.toISOString().split('T')[0];
    dateStartInput.value = lastThreeDays.toISOString().split('T')[0];
}

async function loadSupplementList() {
    const fromDate = dateStartInput.value;
    const toDate = dateEndInput.value;
    const searchTerm = searchInput.value.trim().toUpperCase();

    if (!fromDate || !toDate) return;

    // Adjust toDate to end of day
    const toDateObj = new Date(toDate);
    toDateObj.setHours(23, 59, 59, 999);

    listBody.innerHTML = `<tr><td colspan="11" class="text-center py-8"><div class="animate-spin text-2xl mb-2">⏳</div> Đang tải dữ liệu... Vui lòng đợi.</td></tr>`;

    // OPTIMIZED: Select only needed columns for the list
    const sizeFields = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15]
        .map(s => `"size_${s.toString().replace('.', '_')}"`).join(',');
    const listSelectCols = `created_at,rpro,so,customers,gender,pu,fabric,bom,total,remark,${sizeFields}`;

    let allData = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    try {
        while (hasMore) {
            let query = supabase
                .from('supplement')
                .select(listSelectCols)
                .gte('created_at', new Date(fromDate).toISOString())
                .lte('created_at', toDateObj.toISOString())
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (searchTerm) {
                query = query.ilike('rpro', `%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                allData = allData.concat(data);
                hasMore = data.length === PAGE_SIZE;
                page++;
            } else {
                hasMore = false;
            }
        }

        if (allData.length === 0) {
            listBody.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-gray-500 font-bold italic">Không tìm thấy dữ liệu trong khoảng thời gian này.</td></tr>`;
            return;
        }

        // Fetch already sent records to mark status
        const rpros = allData.map(item => item.rpro);
        const { data: sentRecords, error: sentError } = await supabase
            .from('supplement_confirm')
            .select('rpro')
            .in('rpro', rpros);

        const sentSet = new Set((sentRecords || []).map(r => r.rpro));

        listBody.innerHTML = allData.map(row => {
            const isSent = sentSet.has(row.rpro);
            return `
          <tr class="hover:bg-gray-50 transition border-b">
            <td class="px-4 py-2 border text-sm">${new Date(row.created_at).toLocaleString('vi-VN')}</td>
            <td class="px-4 py-2 border font-mono text-sm sticky left-0 z-10 bg-white drop-shadow-sm font-bold text-blue-600">${row.rpro}</td>
            <td class="px-4 py-2 border text-sm">${row.so || ''}</td>
            <td class="px-4 py-2 border text-sm">${row.customers || ''}</td>
            <td class="px-4 py-2 border text-sm text-center">${row.gender || ''}</td>
            <td class="px-4 py-2 border text-sm">${row.pu || ''}</td>
            <td class="px-4 py-2 border text-sm">${row.fabric || ''}</td>
            <td class="px-4 py-2 border text-sm">${row.bom || ''}</td>
            <td class="px-4 py-2 border text-right font-bold">${row.total}</td>
            <td class="px-4 py-2 border text-sm italic">${row.remark || ''}</td>
            <td class="px-4 py-2 border text-center space-x-2">
              <button onclick="handleSend('${row.rpro}')" class="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold shadow-sm ${isSent ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600 active:scale-95 transition'}">
                ${isSent ? 'Đã gửi' : '🚀 Gửi'}
              </button>
              <button onclick="handleRecall('${row.rpro}')" class="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-red-600 active:scale-95 transition ${!isSent ? 'hidden' : ''}">
                ↩️ Thu hồi
              </button>
            </td>
          </tr>
        `;
        }).join('');
    } catch (error) {
        console.error('Error fetching list:', error);
        listBody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-red-500">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    }
}

window.handleSend = async (rpro) => {
    // OPTIMIZED: Select specifically needed columns to copy
    const sizeFields = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15]
        .map(s => `"size_${s.toString().replace('.', '_')}"`).join(',');
    const copyCols = `rpro,so,customers,gender,pu,fabric,bom,total,remark,remark2,mold,${sizeFields}`;

    const { data: row, error: fetchError } = await supabase
        .from('supplement')
        .select(copyCols)
        .eq('rpro', rpro)
        .limit(1)
        .maybeSingle();

    if (fetchError || !row) {
        alert('Lỗi lấy dữ liệu gốc');
        return;
    }

    // Copy everything except auto-generated/managed columns
    const { created_at, id, updated_at, ...dataToCopy } = row;

    const { error: insertError } = await supabase
        .from('supplement_confirm')
        .upsert([{
            ...dataToCopy,
            created_at: new Date().toISOString()
        }]);

    if (insertError) {
        alert('Lỗi khi gửi dữ liệu: ' + insertError.message);
    } else {
        loadSupplementList();
    }
};

window.handleRecall = async (rpro) => {
    if (!confirm(`Bạn chắc chắn muốn thu hồi đơn ${rpro}?`)) return;

    const { error: deleteError } = await supabase
        .from('supplement_confirm')
        .delete()
        .eq('rpro', rpro);

    if (deleteError) {
        alert('Lỗi khi thu hồi dữ liệu');
    } else {
        loadSupplementList();
    }
};

if (btnRefresh) {
    btnRefresh.addEventListener('click', loadSupplementList);
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadSupplementList();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initDates();
    loadSupplementList();
});
