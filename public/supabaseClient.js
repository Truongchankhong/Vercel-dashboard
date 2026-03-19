// Supabase client (global)
const { createClient } = window.supabase;

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

// --- EGRESS MONITORING ---
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

        // Use native fetch to log usage siliently to bypass the custom fetch wrapper
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
    // Log usage asynhronously
    logEgress(url, options, response);
    return response;
};

// Create the Supabase client with custom fetch
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
        fetch: customFetch
    }
});

// Gắn vào window để script thường dùng được
window.supabase = supabase;