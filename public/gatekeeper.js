import { supabase } from './supabaseClient.js';

/**
 * GATEKEEPER SERVICE
 * Checks if the current page is enabled in system_config
 */
async function checkGatekeeper() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    
    // Exclude monitor page and special pages
    if (path === 'egress-monitor.html' || path === 'login.html') return;

    try {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('id', `status_${path}`)
            .single();

        if (error) {
            // If page is not in the config, we add it as ON by default
            if (error.code === 'PGRST116') { // No rows found
                supabase.from('system_config').insert([{
                    id: `status_${path}`,
                    value: 'ON',
                    description: `Status for ${path}`
                }]);
            }
            return;
        }

        if (data && data.value === 'OFF') {
            document.body.innerHTML = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f1f5f9; color: #1e293b; text-align: center; padding: 24px;">
                    <div style="background: white; padding: 48px; border-radius: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1); max-width: 450px;">
                        <div style="font-size: 80px; margin-bottom: 24px;">🛡️</div>
                        <h1 style="font-size: 1.8rem; font-weight: 900; margin-bottom: 12px; letter-spacing: -0.025em;">HỆ THỐNG TẠM CĂNG</h1>
                        <p style="font-size: 1rem; color: #64748b; line-height: 1.6; margin-bottom: 32px;">
                            Trang web này đã được Quản trị viên tạm thời đóng để bảo trì hoặc bảo mật. Vui lòng quay lại sau.
                        </p>
                        <button onclick="window.location.href='index.html'" style="width: 100%; padding: 16px; background: #6366f1; color: white; border: none; border-radius: 16px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);">
                            QUAY LẠI TRANG CHỦ
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Gatekeeper Error:", err);
    }
}

// Start checking
checkGatekeeper();
