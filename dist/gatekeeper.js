import { supabase } from './supabaseClient.js';

/**
 * GATEKEEPER SERVICE
 * 1. Blocks access to disabled pages.
 * 2. Hides navigation buttons for disabled pages on index.html.
 */

// Mapping of Page Configuration IDs (Table IDs) to DOM Button IDs on index.html
const indexButtonMap = {
    // Real Pages
    'status_supplement.html': 'btn-supplement',
    'status_supplement-confirm.html': 'btn-confirm-page',
    'status_supplement-count.html': 'btn-supplement-count',
    'status_surplus-landing.html': 'btn-surplus-goods',
    'status_internal-checker.html': 'btn-internal-checker',
    
    // Virtual Views (Internal Views in index.html)
    'status_view_summary': 'btn-summary',
    'status_view_progress': 'btn-progress',
    'status_view_delay': 'btn-delay-urgent'
};

async function checkGatekeeper() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    
    // Skip Gatekeeper for monitoring and login
    if (path === 'egress-monitor.html' || path === 'login.html') return;

    // ---------------------------------------------------------
    // OPTIMIZATION: Load ALL status configs in ONE query with cache
    // Cache lasts for 5 minutes in sessionStorage to avoid re-querying
    // ---------------------------------------------------------
    let allConfigs = null;
    const CACHE_KEY = 'gatekeeper_system_config';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.ts < CACHE_TTL) {
                allConfigs = parsed.data;
            }
        }
    } catch (e) { /* ignore parse errors */ }

    if (!allConfigs) {
        // Single query, only 2 columns needed (was 2 separate queries before)
        const { data, error } = await supabase
            .from('system_config')
            .select('id, value')
            .like('id', 'status_%');

        if (!error && data) {
            allConfigs = data;
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
            } catch (e) { /* ignore storage errors */ }
        }
    }

    if (!allConfigs) return; // Failed to load config, allow access

    // ---------------------------------------------------------
    // STEP 1: Handle Index UI Components (Buttons Hiding)
    // ---------------------------------------------------------
    if (path === 'index.html' || path === '') {
        allConfigs.forEach(cfg => {
            if (cfg.value === 'OFF') {
                const btnId = indexButtonMap[cfg.id];
                if (btnId) {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.style.display = 'none';
                }
            }
        });
        // DON'T return yet, need to check if index.html itself is blocked
    }

    // ---------------------------------------------------------
    // STEP 2: Block Access to the Entire Page if OFF (client-side from cache)
    // ---------------------------------------------------------
    try {
        const pageConfig = allConfigs.find(c => c.id === `status_${path}`);

        if (!pageConfig) {
            // Auto-create status config if not found to allow future control
            supabase.from('system_config').insert([{
                id: `status_${path}`,
                value: 'ON',
                description: `Status for ${path}`
            }]);
            return;
        }

        if (pageConfig.value === 'OFF') {
            document.body.innerHTML = `
                <div style="font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #eff6ff; color: #1e3a8a; text-align: center; padding: 24px;">
                    <div style="background: white; padding: 64px; border-radius: 40px; box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.1); max-width: 500px; border: 1px solid #dbeafe;">
                        <div style="font-size: 80px; margin-bottom: 32px;">🛡️</div>
                        <h1 style="font-size: 2rem; font-weight: 900; margin-bottom: 16px; letter-spacing: -0.05em; color: #1e40af;">TÍNH NĂNG TẠM ĐÓNG</h1>
                        <p style="font-size: 1.1rem; color: #64748b; line-height: 1.7; margin-bottom: 40px;">
                            Bảng điều khiển này hiện đang được quản trị viên tạm khóa. Vui lòng liên hệ Admin để được cấp quyền hoặc quay lại sau.
                        </p>
                        <button onclick="window.location.reload()" style="width: 100%; padding: 18px; background: #2563eb; color: white; border: none; border-radius: 20px; font-weight: 800; cursor: pointer; transition: all 0.3s; box-shadow: 0 12px 20px -5px rgba(37, 99, 235, 0.4);">
                            KIỂM TRA LẠI ↻
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Gatekeeper Critical Error:", err);
    }
}

// Ensure execution
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkGatekeeper);
} else {
    checkGatekeeper();
}
