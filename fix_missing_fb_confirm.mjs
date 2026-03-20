import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixFb() {
  try {
    const { data: confirms, error: cErr } = await supabase
      .from('supplement_confirm')
      .select('id, rpro, fb')
      .or('fb.is.null,fb.eq.')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (cErr) throw cErr;

    console.log(`Tìm thấy ${confirms.length} đơn thiếu FB trong bảng confirmed. Đang vá lỗi...`);
    for (let row of confirms) {
      const rpro = row.rpro;
      let foundFb = null;
      
      const { data: pRec } = await supabase.from('powerapp').select('FB').eq('PRO ODER', rpro).maybeSingle();
      if (pRec && pRec['FB']) {
        foundFb = pRec['FB'];
      } else {
        const { data: mRec } = await supabase.from('Masterdata').select('FB').eq('PRO ODER', rpro).maybeSingle();
        if (mRec && mRec['FB']) foundFb = mRec['FB'];
      }
      
      if (foundFb) {
        console.log(`[Confirm] Vá lỗi [${rpro}] -> Mã Vải: ${foundFb}`);
        await supabase.from('supplement_confirm').update({ fb: foundFb }).eq('id', row.id);
      }
    }
    console.log("Hoàn tất vá lỗi FB trên bảng xác nhận!");
  } catch(e) { console.error(e); }
}

fixFb();
