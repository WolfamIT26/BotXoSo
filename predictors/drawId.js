const fs = require('fs');

/**
 * Tính toán drawId tiếp theo an toàn, luôn chỉ tăng 1 đơn vị từ hiện tại
 */
function normalizeDrawId(drawId) {
    if (!drawId) return drawId;
    return drawId.replace(/_\d+$/, '');
}

/**
 * Tạo drawId tiếp theo từ drawId hiện tại
 * @param {string} currentDrawId - DrawID hiện tại
 * @returns {string} DrawID tiếp theo
 */
function generateNextDrawId(currentDrawId) {
    if (!currentDrawId) return null;
    
    // Chuẩn hóa currentDrawId (loại bỏ hậu tố _1, _2, v.v nếu có)
    const normalizedDrawId = normalizeDrawId(currentDrawId);
    
    // Lấy số cuối cùng của currentDrawId và tăng lên 1
    const currentNumber = parseInt(normalizedDrawId.slice(-4));
    const nextNumber = currentNumber + 1;
    
    // Giữ nguyên phần prefix của DrawID
    const prefix = normalizedDrawId.slice(0, -4);
    
    // Format số mới với đúng 4 chữ số và thêm vào prefix
    const nextDrawId = prefix + nextNumber.toString().padStart(4, '0');
    
    return nextDrawId;
}

function calculateSafeNextDrawId(currentDrawId, predictionsFile, historyLogFile) {
    // Chuẩn hóa currentDrawId (loại bỏ hậu tố _1, _2, v.v nếu có)
    currentDrawId = currentDrawId.replace(/_\d+$/, '');
    
    // Lấy số cuối cùng của currentDrawId và tăng lên 1
    const currentNumber = parseInt(currentDrawId.slice(-4));
    let nextNumber = currentNumber + 1;
    
    // Giữ nguyên phần prefix của DrawID
    const prefix = currentDrawId.slice(0, -4);
    
    // Kiểm tra predictions.json hiện tại
    let existingDrawId = null;
    if (predictionsFile) {
        if (!fs.existsSync(predictionsFile)) {
            // Tạo file rỗng nếu chưa tồn tại
            try {
                fs.writeFileSync(predictionsFile, '{}', 'utf8');
                console.log(`📄 File dự đoán không tồn tại, tạo file mới: ${predictionsFile}`);
            } catch (error) {
                console.error(`❌ Lỗi khi tạo file predictions.json: ${error.message}`);
            }
        }
        
        // Tiếp tục với file đã tồn tại hoặc mới tạo
        if (fs.existsSync(predictionsFile)) {
            try {
                const predictions = JSON.parse(fs.readFileSync(predictionsFile, 'utf8'));
                if (predictions && predictions.drawId) {
                    existingDrawId = predictions.drawId.replace(/_\d+$/, '');
                    const existingNumber = parseInt(existingDrawId.slice(-4));
                    
                    // Nếu đã có dự đoán cho kỳ tiếp theo hoặc cao hơn, tăng thêm 1
                    if (existingNumber >= nextNumber) {
                        nextNumber = existingNumber + 1;
                    }
                }
            } catch (error) {
                console.error(`❌ Lỗi khi đọc predictions.json: ${error.message}`);
            }
        }
    }
    
    // Kiểm tra prediction_log.txt để tránh trùng lặp
    if (historyLogFile && fs.existsSync(historyLogFile)) {
        try {
            const logContent = fs.readFileSync(historyLogFile, 'utf8');
            const logLines = logContent.split('\n');
            
            // Lấy dòng cuối cùng có nội dung
            for (let i = logLines.length - 1; i >= 0; i--) {
                if (logLines[i].trim()) {
                    const match = logLines[i].match(/] - (\d+) -/);
                    if (match && match[1]) {
                        const lastLoggedId = match[1];
                        const lastLoggedNumber = parseInt(lastLoggedId.slice(-4));
                        
                        // Nếu log đã có kỳ tiếp theo hoặc cao hơn, tăng thêm 1
                        if (lastLoggedNumber >= nextNumber) {
                            console.log(`ℹ️ Phát hiện log đã có kỳ ${lastLoggedId}, tăng nextNumber`);
                            nextNumber = lastLoggedNumber + 1;
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Lỗi khi đọc prediction_log.txt: ${error.message}`);
        }
    }
    
    const nextDrawId = prefix + nextNumber.toString().padStart(4, '0');
    return nextDrawId;
}

module.exports = {
    calculateSafeNextDrawId,
    normalizeDrawId,
    generateNextDrawId
};