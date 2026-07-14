(function() {
    window.saveExcelFile = async function(workbook, filename, showToastFn) {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file) {
            try {
                if (typeof XLSX === 'undefined') {
                    throw new Error("XLSX library is not loaded");
                }
                const b64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
                const actualName = await window.pywebview.api.save_file(b64, filename);
                const msg = `✅ Đã lưu vào Downloads: 📄 ${actualName}`;
                if (typeof showToastFn === 'function') {
                    showToastFn(msg, "success");
                } else if (typeof showToast === 'function') {
                    showToast(msg, "success");
                } else {
                    alert(msg);
                }
            } catch (err) {
                console.error("Lỗi lưu file qua Desktop API:", err);
                const errMsg = "❌ Lỗi lưu file: " + err.message;
                if (typeof showToastFn === 'function') {
                    showToastFn(errMsg, "error");
                } else if (typeof showToast === 'function') {
                    showToast(errMsg, "error");
                } else {
                    alert(errMsg);
                }
            }
        } else {
            XLSX.writeFile(workbook, filename);
            const msg = "✅ Đã tải file Excel thành công!";
            if (typeof showToastFn === 'function') {
                showToastFn(msg, "success");
            } else if (typeof showToast === 'function') {
                showToast(msg, "success");
            }
        }
    };
})();
