/**
 * Module phân tích hiệu suất theo thời gian
 * 
 * Module này giúp phân tích hiệu suất dự đoán theo các khung giờ khác nhau:
 * 1. Xác định khung giờ hiện tại (sáng, trưa, chiều, tối)
 * 2. Phân tích hiệu suất dự đoán trong từng khung giờ
 * 3. Điều chỉnh tham số dự đoán dựa trên hiệu suất lịch sử theo thời gian
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Biến lưu trữ hiệu suất theo thời gian
const timeSegmentStats = {
    morning: { total: 0, correct: 0, lastTai: 0, lastXiu: 0 },
    noon: { total: 0, correct: 0, lastTai: 0, lastXiu: 0 },
    afternoon: { total: 0, correct: 0, lastTai: 0, lastXiu: 0 },
    evening: { total: 0, correct: 0, lastTai: 0, lastXiu: 0 },
    latenight: { total: 0, correct: 0, lastTai: 0, lastXiu: 0 }
};

// Cache cho phân tích dữ liệu
let timeAnalysisCache = {
    predictions: {},
    lastUpdated: 0
};

/**
 * Xác định khung giờ hiện tại
 * @returns {string} Tên khung giờ ('morning', 'afternoon', 'evening', 'night', 'latenight')
 */
function getCurrentTimeSegment() {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 5 && hour < 11) return 'morning';    // Sáng: 05:00 - 11:00
    if (hour >= 11 && hour < 13) return 'noon';      // Trưa: 11:00 - 13:00
    if (hour >= 13 && hour < 18) return 'afternoon'; // Chiều: 13:00 - 18:00
    if (hour >= 18 && hour < 22) return 'evening';   // Tối: 18:00 - 22:00
    return 'latenight';                              // Khuya: 22:00 - 05:00
}

/**
 * Phân tích hiệu suất dự đoán theo thời gian
 * @param {string} logFile - Đường dẫn đến file log dự đoán
 * @returns {Object} Thống kê hiệu suất theo khung giờ
 */
function analyzeTimePerformance(logFile) {
    // Chỉ cập nhật cache mỗi 30 phút
    const now = Date.now();
    if (now - timeAnalysisCache.lastUpdated < 1800000 && Object.keys(timeAnalysisCache.predictions).length > 0) {
        return timeAnalysisCache.predictions;
    }
    
    if (!fs.existsSync(logFile)) return {};
    
    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        // Biến lưu kết quả
        const timeStats = {
            morning: { total: 0, correct: 0, taiCorrect: 0, taiTotal: 0, xiuCorrect: 0, xiuTotal: 0 },
            afternoon: { total: 0, correct: 0, taiCorrect: 0, taiTotal: 0, xiuCorrect: 0, xiuTotal: 0 },
            evening: { total: 0, correct: 0, taiCorrect: 0, taiTotal: 0, xiuCorrect: 0, xiuTotal: 0 },
            night: { total: 0, correct: 0, taiCorrect: 0, taiTotal: 0, xiuCorrect: 0, xiuTotal: 0 }
        };
        
        // Phân tích mỗi dòng log
        for (const line of lines) {
            // Lấy thời gian từ log
            const timeMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\]/);
            if (!timeMatch) continue;
            
            const hour = parseInt(timeMatch[1], 10);
            let segment;
            
            // Xác định khung giờ
            if (hour >= 5 && hour < 11) segment = 'morning';     // Sáng: 05:00 - 11:00
            else if (hour >= 11 && hour < 13) segment = 'noon';  // Trưa: 11:00 - 13:00
            else if (hour >= 13 && hour < 18) segment = 'afternoon'; // Chiều: 13:00 - 18:00
            else if (hour >= 18 && hour < 22) segment = 'evening';   // Tối: 18:00 - 22:00
            else segment = 'latenight';                          // Khuya: 22:00 - 05:00
            
            // Tăng tổng số dự đoán
            timeStats[segment].total++;
            
            // Kiểm tra kết quả dự đoán
            const isTaiPrediction = line.includes('Dự đoán: Tài');
            const isCorrect = line.includes('Đúng ✓');
            
            if (isCorrect) {
                timeStats[segment].correct++;
            }
            
            if (isTaiPrediction) {
                timeStats[segment].taiTotal++;
                if (isCorrect) timeStats[segment].taiCorrect++;
            } else {
                timeStats[segment].xiuTotal++;
                if (isCorrect) timeStats[segment].xiuCorrect++;
            }
        }
        
        // Tính độ tin cậy cho mỗi khung giờ
        const predictions = {};
        for (const [segment, stats] of Object.entries(timeStats)) {
            if (stats.total === 0) continue;
            
            // Tỷ lệ chính xác tổng thể
            const accuracy = stats.correct / stats.total;
            
            // Tỷ lệ đúng của Tài và Xỉu
            const taiAccuracy = stats.taiTotal > 0 ? stats.taiCorrect / stats.taiTotal : 0;
            const xiuAccuracy = stats.xiuTotal > 0 ? stats.xiuCorrect / stats.xiuTotal : 0;
            
            // Tính độ tin cậy
            const confidence = Math.max(0.5, accuracy);
            
            // Xác định nên dự đoán Tài hay Xỉu dựa trên hiệu suất
            const predictTai = taiAccuracy > xiuAccuracy;
            
            predictions[segment] = {
                accuracy,
                taiAccuracy,
                xiuAccuracy,
                confidence,
                predictTai,
                sample: stats.total
            };
        }
        
        // Cập nhật cache
        timeAnalysisCache = {
            predictions,
            lastUpdated: now
        };
        
        return predictions;
    } catch (error) {
        console.error(`Lỗi khi phân tích hiệu suất theo thời gian: ${error.message}`);
        return {};
    }
}

/**
 * Dự đoán dựa trên hiệu suất thời gian
 * @param {string} logFile - Đường dẫn đến file log dự đoán
 * @returns {Object} Kết quả dự đoán
 */
function predictFromTimeAnalysis(logFile) {
    if (!config.timeAnalysis || !config.timeAnalysis.enabled) {
        return { detected: false };
    }
    
    try {
        const currentSegment = getCurrentTimeSegment();
        
        // Chỉ áp dụng nếu khung giờ hiện tại được cấu hình
        if (!config.timeAnalysis.segments[currentSegment] || 
            !config.timeAnalysis.segments[currentSegment].enabled) {
            return { detected: false };
        }
        
        // Phân tích hiệu suất lịch sử
        const timePerformance = analyzeTimePerformance(logFile);
        
        // Tính toán độ tin cậy cuối cùng
        const configConfidence = config.timeAnalysis.segments[currentSegment].confidenceBoost;
        
        // Nếu chưa đủ dữ liệu hoặc độ tin cậy thấp, sử dụng cấu hình mặc định
        if (!timePerformance[currentSegment] || 
            timePerformance[currentSegment].sample < config.timeAnalysis.minSamplesRequired) {
            
            return {
                detected: true,
                predictTai: config.timeAnalysis.segments[currentSegment].defaultPredictTai,
                confidence: configConfidence,
                method: "TimeAnalysis",
                reason: `Khung giờ ${currentSegment} (${Math.round(configConfidence*100)}%)`
            };
        }
        
        // Sử dụng kết quả phân tích lịch sử
        const finalConfidence = Math.min(0.95, 
            timePerformance[currentSegment].confidence + configConfidence);
        
        return {
            detected: true,
            predictTai: timePerformance[currentSegment].predictTai,
            confidence: finalConfidence,
            method: "TimeAnalysis",
            reason: `Khung giờ ${currentSegment} (${Math.round(finalConfidence*100)}%)`
        };
    } catch (error) {
        console.error(`Lỗi khi dự đoán theo thời gian: ${error.message}`);
        return { detected: false };
    }
}

/**
 * Cập nhật hiệu suất theo thời gian
 * @param {Object} prediction - Dự đoán đã thực hiện
 * @param {boolean} isCorrect - Kết quả dự đoán đúng hay sai
 * @param {boolean} isTai - Dự đoán là Tài hay Xỉu
 */
function updateTimePerformance(prediction, isCorrect, isTai) {
    if (!prediction || prediction.method !== "TimeAnalysis") {
        return;
    }
    
    const segment = getCurrentTimeSegment();
    timeSegmentStats[segment].total++;
    
    if (isCorrect) {
        timeSegmentStats[segment].correct++;
    }
    
    if (isTai) {
        timeSegmentStats[segment].lastTai = isCorrect ? 
            timeSegmentStats[segment].lastTai + 1 : 0;
        timeSegmentStats[segment].lastXiu = 0;
    } else {
        timeSegmentStats[segment].lastXiu = isCorrect ? 
            timeSegmentStats[segment].lastXiu + 1 : 0;
        timeSegmentStats[segment].lastTai = 0;
    }
}

/**
 * Xác định khung giờ khó khăn (hiệu suất thấp)
 * @param {string} logFile - Đường dẫn đến file log dự đoán
 * @param {number} sampleSize - Số lượng mẫu để xác định (mặc định là 20)
 * @returns {boolean} Có phải khung giờ khó khăn không
 */
function isDifficultPeriod(logFile, sampleSize = 20) {
    if (!config.betting.difficultPeriodHandling ||
        !config.betting.difficultPeriodHandling.enabled) {
        return false;
    }
    
    try {
        const performance = analyzeTimePerformance(logFile);
        const currentSegment = getCurrentTimeSegment();
        
        // Kiểm tra nếu khung giờ hiện tại có hiệu suất thấp
        if (performance[currentSegment] && 
            performance[currentSegment].sample >= sampleSize &&
            performance[currentSegment].accuracy < config.betting.difficultPeriodHandling.accuracyThreshold) {
            return true;
        }
        
        // Kiểm tra hiệu suất gần đây
        const recentAccuracy = getRecentAccuracy(logFile, sampleSize);
        return recentAccuracy < config.betting.difficultPeriodHandling.recentAccuracyThreshold;
    } catch (error) {
        console.error(`Lỗi khi xác định khung giờ khó khăn: ${error.message}`);
        return false;
    }
}

/**
 * Tính hiệu suất gần đây
 * @param {string} logFile - Đường dẫn đến file log dự đoán
 * @param {number} sampleSize - Số lượng mẫu để xem xét
 * @returns {number} Tỷ lệ chính xác gần đây
 */
function getRecentAccuracy(logFile, sampleSize = 20) {
    if (!fs.existsSync(logFile)) return 0.5;
    
    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n')
            .filter(line => line.trim())
            .slice(0, sampleSize);
        
        if (lines.length === 0) return 0.5;
        
        const correctPredictions = lines.filter(line => line.includes('Đúng ✓')).length;
        return correctPredictions / lines.length;
    } catch (error) {
        console.error(`Lỗi khi tính độ chính xác gần đây: ${error.message}`);
        return 0.5;
    }
}

module.exports = {
    getCurrentTimeSegment,
    analyzeTimePerformance,
    predictFromTimeAnalysis,
    updateTimePerformance,
    isDifficultPeriod,
    getRecentAccuracy
}; 