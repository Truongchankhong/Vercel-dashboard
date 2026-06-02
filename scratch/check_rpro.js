import fetch from 'node-fetch';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

const RPRO = "RPRO-260410-0135";

async function check() {
    try {
        console.log(`=== BẮT ĐẦU KIỂM TRA ĐƠN: ${RPRO} ===\n`);
        
        // 1. Query supplement_confirm
        const resConfirm = await fetch(`${SUPABASE_URL}/rest/v1/supplement_confirm?rpro=eq.${RPRO}&select=*`, { headers });
        const dataConfirm = await resConfirm.json();
        console.log(`--- DỮ LIỆU TRONG supplement_confirm (${dataConfirm.length} dòng): ---`);
        dataConfirm.forEach((row, i) => {
            console.log(`Dòng ${i+1}:`);
            console.log(`  - ID: ${row.id}`);
            console.log(`  - SO: ${row.so}`);
            console.log(`  - Total Qty: ${row.total}`);
            console.log(`  - Available: ${row.available_supplement}`);
            console.log(`  - Confirm Status: ${row.confirm}`);
            console.log(`  - Remark: ${row.remark}`);
            console.log(`  - Remark2 (Lần làm lại): ${row.remark2}`);
            console.log(`  - Ngày tạo: ${row.created_at}`);
            console.log(`  - Ngày cập nhật: ${row.updated_at}`);
        });

        console.log("\n");

        // 2. Query supplement_tracking
        const resTracking = await fetch(`${SUPABASE_URL}/rest/v1/supplement_tracking?rpro=eq.${RPRO}&select=*`, { headers });
        const dataTracking = await resTracking.json();
        console.log(`--- LỊCH SỬ QUÉT TRONG supplement_tracking (${dataTracking.length} dòng): ---`);
        // Sort by created_at ascending
        const sortedTracking = dataTracking.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        sortedTracking.forEach((row, i) => {
            console.log(`[${i+1}] ${row.created_at} | Section: ${row.section} | Action: ${row.action} | Qty: ${row.quantity} | Operator: ${row.operator} | Note: ${row.note || ''}`);
        });

    } catch (e) {
        console.error("Lỗi:", e);
    }
}

check();
