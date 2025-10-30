@echo off
cd /d "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\WEEKLY REPORT\WE ARE BETTER\vercel-dashboard"
echo ==== Sync started at %date% %time% ====
node public/sync-supplement-qr-supabase.js
echo ==== Sync finished at %date% %time% ====
