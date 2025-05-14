const fs = require('fs');

/**
 * Phân tích kết quả gần đây từ file log
 */
function analyzeRecentResults(logFile, limit = 15) {
  const results = [];

  if (!fs.existsSync(logFile)) {
    return results;
  }

  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    // Lấy các dòng gần nhất
    const recentLines = lines.slice(-limit);

    for (const line of recentLines) {
      const actualMatch = line.match(/Số thực tế: (\d+) \((Tài|Xỉu)\)/);
      const predictedMatch = line.match(/Dự đoán: (\d+) \((Tài|Xỉu)\)/);
      const isCorrect = line.includes('| Đúng');

      if (actualMatch && predictedMatch) {
        results.push({
          actualNumber: parseInt(actualMatch[1]),
          actualType: actualMatch[2],
          predictedNumber: parseInt(predictedMatch[1]),
          predictedType: predictedMatch[2],
          isCorrect: isCorrect
        });
      }
    }

    // Đảo ngược mảng để các kết quả gần nhất ở đầu
    return results.reverse();
  } catch (error) {
    console.error(`❌ Lỗi khi đọc file log: ${error.message}`);
    return [];
  }
}

/**
 * Phân tích thống kê gần đây
 */
function analyzeRecentStats(historyLogFile) {
  try {
    if (fs.existsSync(historyLogFile)) {
      const logContent = fs.readFileSync(historyLogFile, 'utf8');
      const logLines = logContent.split('\n').filter(line => line.trim() !== '');
      
      // Đếm số dự đoán đúng/sai trong 15 kỳ gần nhất
      const recent = logLines.slice(Math.max(0, logLines.length - 15));
      const correctCount = recent.filter(line => line.includes('Đúng')).length;
      
      return {
        correct: correctCount,
        total: recent.length,
        rate: correctCount / recent.length
      };
    }
  } catch (error) {
    console.error('Error analyzing stats:', error);
  }
  
  return { correct: 0, total: 0, rate: 0 };
}

/**
 * Ghi log cho việc đảo ngược dự đoán
 * @param {string} logFile - Đường dẫn file log
 * @param {string} drawId - ID của kỳ quay
 * @param {string} originalMethod - Phương pháp gốc
 * @param {boolean} originalPrediction - Dự đoán gốc (true = Tài, false = Xỉu)
 * @param {boolean} reversedPrediction - Dự đoán sau khi đảo ngược (true = Tài, false = Xỉu)
 * @param {string} reason - Lý do đảo ngược
 */
function logPredictionReversal(logFile, drawId, originalMethod, originalPrediction, reversedPrediction, reason) {
  try {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    
    const originalType = originalPrediction ? 'Tài' : 'Xỉu';
    const reversedType = reversedPrediction ? 'Tài' : 'Xỉu';
    
    const logEntry = `[${timeStr}] - ${drawId} - ⚠️ ĐẢO NGƯỢC dự đoán: ${originalType} -> ${reversedType} | Phương pháp: ${originalMethod} | Lý do: ${reason}\n`;
    
    // Đảm bảo thư mục tồn tại
    const dir = require('path').dirname(logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Ghi vào file
    let existingContent = '';
    if (fs.existsSync(logFile)) {
      existingContent = fs.readFileSync(logFile, 'utf8');
    }
    
    fs.writeFileSync(logFile, logEntry + existingContent, 'utf8');
    
    return true;
  } catch (error) {
    console.error(`❌ Lỗi khi ghi log đảo ngược dự đoán: ${error.message}`);
    return false;
  }
}

module.exports = {
  analyzeRecentResults,
  analyzeRecentStats,
  logPredictionReversal
};