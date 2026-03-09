import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://jkdxacbhxzitpytqsfam.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZHhhY2JoeHppdHB5dHFzZmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyNTEzMTAsImV4cCI6MjA1NDgyNzMxMH0.ioA0pkMEEhGqPV6b8FE_FfSRE0y89J3JByJKKfgLdOU'
);

async function check() {
    // Check latest 20 records
    console.log('=== LATEST 20 RECORDS ===');
    const { data, error } = await supabase
        .from('supplement_tracking')
        .select('rpro, section, action, quantity, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) console.error('Error:', error);
    if (data) {
        data.forEach(r => {
            console.log(`${r.created_at} | ${r.action.padEnd(4)} | ${r.section.padEnd(8)} | qty: ${r.quantity || 0} | ${r.rpro}`);
        });
    }

    // Count by action type overall
    console.log('\n=== COUNT TOTAL BY ACTION ===');
    const { data: all } = await supabase
        .from('supplement_tracking')
        .select('action, quantity, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);

    if (all) {
        // Group by month + action
        const monthAction = {};
        all.forEach(r => {
            const month = r.created_at.substring(0, 7); // YYYY-MM
            const key = `${month} | ${r.action}`;
            if (!monthAction[key]) monthAction[key] = { count: 0, totalQty: 0 };
            monthAction[key].count++;
            monthAction[key].totalQty += (r.quantity || 0);
        });

        Object.entries(monthAction).sort().forEach(([key, val]) => {
            console.log(`${key}: ${val.count} records, total qty: ${val.totalQty}`);
        });
    }
}

check();
