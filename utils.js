// utils.js
export async function readPowerAppJSON() {
  try {
    // Tải trực tiếp JSON tĩnh (đường dẫn relative đủ dùng trên Vercel)
    const res = await fetch('/powerapp.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch powerapp.json:', err);
    return [];
  }
}
