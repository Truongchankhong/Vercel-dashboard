const { supabase } = require('./public/supabaseClient.node.js');

async function fixFb() {
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

  console.log("Hoàn tất vá lỗi FB trên Database!");
}

fixFb();
