// Supabase client initialization
// Ensure the Supabase library is loaded before this script runs
const supabaseLib = window.supabase;

if (!supabaseLib || !supabaseLib.createClient) {
    console.error("Supabase library not found! Please ensure <script src='...supabase-js@2'></script> is included before this module.");
}

const { createClient } = supabaseLib;

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

// --- EGRESS MONITORING INTERCEPTOR ---
async function logEgress(url, options, response) {
    if (url.includes('usage_logs')) return; // Avoid infinite loop

    try {
        const clone = response.clone();
        const data = await clone.json();
        const sizeBytes = new Blob([JSON.stringify(data)]).size;
        const count = Array.isArray(data) ? data.length : 1;

        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const tableName = pathParts[pathParts.length - 1] || 'unknown';

        // Use native fetch to log usage siliently to bypass this custom fetch wrapper
        fetch(`${SUPABASE_URL}/rest/v1/usage_logs`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                page_path: window.location.pathname,
                table_name: tableName,
                action: options.method || 'GET',
                size_bytes: sizeBytes,
                record_count: count
            })
        });
    } catch (e) {
        // Not a JSON response or failed clone, skip logging
    }
}

const customFetch = async (url, options) => {
    const response = await fetch(url, options);
    logEgress(url, options, response);
    return response;
};

// Create the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Attach to window using a distinct name to avoid clashing with the 'supabase' library global
window.supabaseClient = supabase;
// Polyfill for scripts expecting window.supabase as the client (if necessary)
// Note: Be careful, as this might break the library itself if used as a library global.
// Only do this if we are sure no further calls to the library global are needed.
// window.supabase = supabase; 