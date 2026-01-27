
import { supabase } from './supabaseClient.js';

const listBody = document.getElementById('list-body');

async function loadSupplementList() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data, error } = await supabase
        .from('supplement')
        .select('*')
        .gte('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching list:', error);
        listBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Lỗi tải dữ liệu</td></tr>`;
        return;
    }

    // Fetch already sent records to mark status
    const rpros = data.map(item => item.rpro);
    const { data: sentRecords, error: sentError } = await supabase
        .from('supplement_confirm')
        .select('rpro')
        .in('rpro', rpros);

    const sentSet = new Set((sentRecords || []).map(r => r.rpro));

    if (data.length === 0) {
        listBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Trống (3 ngày qua)</td></tr>`;
        return;
    }

    listBody.innerHTML = data.map(row => {
        const isSent = sentSet.has(row.rpro);
        return `
      <tr>
        <td class="px-4 py-2 border text-sm">${new Date(row.created_at).toLocaleString('vi-VN')}</td>
        <td class="px-4 py-2 border font-mono text-sm">${row.rpro}</td>
        <td class="px-4 py-2 border text-sm">${row.so || ''}</td>
        <td class="px-4 py-2 border text-sm">${row.customers || ''}</td>
        <td class="px-4 py-2 border text-right font-bold">${row.total}</td>
        <td class="px-4 py-2 border text-sm italic">${row.remark || ''}</td>
        <td class="px-4 py-2 border text-center space-x-2">
          <button onclick="handleSend('${row.rpro}')" class="px-2 py-1 bg-green-500 text-white rounded text-xs ${isSent ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}">
            ${isSent ? 'Đã gửi' : 'Gửi'}
          </button>
          <button onclick="handleRecall('${row.rpro}')" class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 ${!isSent ? 'hidden' : ''}">
            Thu hồi
          </button>
        </td>
      </tr>
    `;
    }).join('');
}

window.handleSend = async (rpro) => {
    const { data: row, error: fetchError } = await supabase
        .from('supplement')
        .select('*')
        .eq('rpro', rpro)
        .single();

    if (fetchError || !row) {
        alert('Lỗi lấy dữ liệu gốc');
        return;
    }

    // Copy everything except created_at (auto-generated)
    const { created_at, ...dataToCopy } = row;

    const { error: insertError } = await supabase
        .from('supplement_confirm')
        .upsert([dataToCopy]);

    if (insertError) {
        console.error('Error sending:', insertError);
        alert('Lỗi khi gửi dữ liệu');
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
        console.error('Error recalling:', deleteError);
        alert('Lỗi khi thu hồi dữ liệu');
    } else {
        loadSupplementList();
    }
};

document.addEventListener('DOMContentLoaded', loadSupplementList);
