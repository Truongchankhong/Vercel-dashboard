import XLSX from 'xlsx';

// A date string representing 15:13:23 local time (Vietnam UTC+7) or 08:13:23 UTC
const isoString = "2026-06-19T08:13:23.099Z"; 

// Original Date object
const d1 = new Date(isoString);

// Shifted Date object as currently done in the codebase:
// toLocalDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
const toLocalDate = (dateVal) => {
    const d = new Date(dateVal);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};
const d2 = toLocalDate(isoString);

console.log("Original Date (d1):");
console.log("- UTC:  ", d1.toUTCString());
console.log("- Local:", d1.toString());

console.log("\nShifted Date (d2):");
console.log("- UTC:  ", d2.toUTCString());
console.log("- Local:", d2.toString());

// Test with SheetJS
const exportData = [
    {
        Name: "Original Date",
        DateValue: d1
    },
    {
        Name: "Shifted Date",
        DateValue: d2
    }
];

const worksheet = XLSX.utils.json_to_sheet(exportData, { cellDates: true });
console.log("\nSheetJS Cell values:");
console.log("A2 (Original label):", worksheet['A2']?.v);
console.log("B2 (Original Date cell):", worksheet['B2']?.v, "| Raw date object:", worksheet['B2']?.v instanceof Date ? worksheet['B2']?.v.toUTCString() : "not date");
console.log("A3 (Shifted label):", worksheet['A3']?.v);
console.log("B3 (Shifted Date cell):", worksheet['B3']?.v, "| Raw date object:", worksheet['B3']?.v instanceof Date ? worksheet['B3']?.v.toUTCString() : "not date");

// Check the formatted text in SheetJS
XLSX.utils.sheet_to_txt(worksheet); // run formatter
console.log("\nFormatted Text:");
console.log("B2 formatted:", worksheet['B2']?.w || "No format info");
console.log("B3 formatted:", worksheet['B3']?.w || "No format info");

// Set format pattern
worksheet['B2'].z = 'dd/mm/yyyy hh:mm:ss';
worksheet['B3'].z = 'dd/mm/yyyy hh:mm:ss';
// Let's write to a buffer and read it back or check how format is rendered.
const wopts = { bookType: 'xlsx', bookSST: false, type: 'binary' };
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, worksheet, "Sheet1");
const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

const wbRead = XLSX.read(out, { type: 'buffer' });
const wsRead = wbRead.Sheets["Sheet1"];
console.log("\nAfter Reading from Excel Buffer:");
console.log("B2 (Original):", wsRead['B2']?.v, "| Formatted:", wsRead['B2']?.w);
console.log("B3 (Shifted):", wsRead['B3']?.v, "| Formatted:", wsRead['B3']?.w);
