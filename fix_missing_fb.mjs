import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixFb() {
  try {
    console.log("Tìm kiếm các dòng thiếu FB trong supplement...");
    
    // Lấy các RPRO thiếu FB trong supplement
    const { data: supplements, error: sErr } = await supabase
      .from('supplement')
      .select('id, rpro, fb')
      .or('fb.is.null,fb.eq.')
      .limit(100);

    if (sErr) throw sErr;
    console.log(`Tìm thấy ${supplements.length} đơn thiếu FB trong bảng supplement. Đang vá lỗi...`);
  
  for (let row of supplements) {
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
      console.log(`[Supplement] Vá lỗi [${rpro}] -> Mã Vải: ${foundFb}`);
      await supabase.from('supplement').update({ fb: foundFb }).eq('rpro', rpro);
    }
  }

  // Cập nhật các confirm
  const { data: confirms, error: cErr } = await supabase
    .from('supplement_confirm')
    .select('id, rpro, fb')
    .or('fb.is.null,fb.eq.')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!cErr) {
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
  }

    console.log("Hoàn tất vá lỗi FB trên Database! Bạn hãy F5 để dọn lại giao diện nhé!");
  } catch (err) {
    console.error("LỖI CHƯA XỬ LÝ:", err);
  }
}

fixFb();
