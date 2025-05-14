/**
 * AdaptivePatternRecognition - Thuật toán tự thích ứng với mẫu thay đổi
 * Phiên bản: v1.0.0
 * 
 * Thuật toán này nhằm mục đích:
 * 1. Tự động điều chỉnh trọng số dựa trên hiệu suất
 * 2. Phát hiện và xử lý chuỗi thất bại liên tiếp
 * 3. Tính đến yếu tố thời gian trong dự đoán
 * 4. Trích xuất và khai thác các mẫu đặc biệt
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Cache hiệu suất trong bộ nhớ (không lưu file)
let methodPerformanceCache = {};
let recentPredictions = [];
let streakDetectionCache = {};
let timePerformanceData = {
    morning: { taiCount: 0, xiuCount: 0, lastTenResults: [] },
    noon: { taiCount: 0, xiuCount: 0, lastTenResults: [] },
    afternoon: { taiCount: 0, xiuCount: 0, lastTenResults: [] },
    evening: { taiCount: 0, xiuCount: 0, lastTenResults: [] },
    latenight: { taiCount: 0, xiuCount: 0, lastTenResults: [] }
};
let specialPatternStats = {};

/**
 * Phân tích dữ liệu lịch sử và nhận dạng mẫu thích nghi
 * @param {Array} history - Mảng lịch sử kết quả
 * @param {Number} index - Vị trí trong mảng numbers cần dự đoán
 * @returns {Object} Đối tượng dự đoán
 */
function detectAdaptivePattern(history, index = 0) {
    if (!history || !Array.isArray(history) || history.length < config.analysis.minimumHistoryRequired) {
        return { confidence: 0 };
    }

    // Đảm bảo dữ liệu là số
    const recentResults = history.slice(0, config.analysis.historyLimit).map(item => {
        if (item.numbers && Array.isArray(item.numbers)) {
            return {
                ...item,
                numbers: item.numbers.map(num => 
                    typeof num === 'string' ? parseInt(num, 10) : num)
            };
        }
        return item;
    });

    // Chuyển đổi lịch sử thành mảng "T" (Tài) và "X" (Xỉu)
    const resultPattern = recentResults.map(item => 
        item.numbers[index] >= 5 ? 'T' : 'X');
    
    console.log(`Mẫu gần đây: ${resultPattern.slice(0, 10).join('')}`);
    
    // Phân tích các mẫu đặc biệt (cấu hình trong config)
    const specialPatternResult = analyzeSpecialPatterns(resultPattern);
    if (specialPatternResult.detected) {
        console.log(`Phát hiện mẫu đặc biệt: ${specialPatternResult.pattern}`);
        return specialPatternResult;
    }
    
    // Phát hiện và xử lý chuỗi thất bại
    const streakResult = detectAndHandleStreaks(resultPattern, recentPredictions);
    if (streakResult.confidence > 0) {
        console.log(`Phát hiện chuỗi: ${streakResult.streakType} (Độ tin cậy: ${streakResult.confidence.toFixed(2)})`);
        return streakResult;
    }
    
    // Phân tích dữ liệu theo thời gian
    const timeResult = analyzeTimePatterns(recentResults);
    if (timeResult.confidence > 0) {
        console.log(`Phát hiện mẫu theo thời gian: ${timeResult.timePattern} (Độ tin cậy: ${timeResult.confidence.toFixed(2)})`);
        return timeResult;
    }
    
    // Phân tích biến động và sự thay đổi đột ngột
    const volatilityResult = analyzeVolatility(resultPattern);
    if (volatilityResult.volatilityDetected) {
        console.log(`Phát hiện biến động: ${volatilityResult.volatilityLevel}`);
        return {
            predictTai: volatilityResult.predictTai,
            confidence: volatilityResult.confidence,
            method: "AdaptivePattern_Volatility",
            reason: volatilityResult.reason
        };
    }
    
    // Tính toán cân bằng Tài/Xỉu trong lịch sử gần đây
    const taiCount = resultPattern.filter(r => r === 'T').length;
    const xiuCount = resultPattern.length - taiCount;
    
    // Phân tích chuỗi kết quả gần đây
    const lastThree = resultPattern.slice(0, 3);
    const lastFive = resultPattern.slice(0, 5);
    
    // Đếm số lần chuyển đổi (T->X hoặc X->T)
    let switchCount = 0;
    for (let i = 1; i < resultPattern.length; i++) {
        if (resultPattern[i] !== resultPattern[i - 1]) {
            switchCount++;
        }
    }
    
    // Tỷ lệ chuyển đổi
    const switchRate = switchCount / (resultPattern.length - 1);
    
    // Chiến lược dự đoán thích ứng
    if (switchRate > 0.7) {
        // Nếu có nhiều chuyển đổi, dự đoán ngược với kết quả trước đó
        return {
            predictTai: resultPattern[0] === 'X',
            confidence: Math.min(0.65 + (switchRate - 0.7) * 2, 0.85),
            method: "AdaptivePattern_HighSwitch",
            reason: `Tỷ lệ chuyển đổi cao (${(switchRate * 100).toFixed(1)}%), dự đoán ngược với kết quả trước đó`
        };
    } else if (switchRate < 0.3) {
        // Nếu ít chuyển đổi, dự đoán giống với kết quả trước đó
        return {
            predictTai: resultPattern[0] === 'T',
            confidence: Math.min(0.65 + (0.3 - switchRate) * 2, 0.85),
            method: "AdaptivePattern_LowSwitch",
            reason: `Tỷ lệ chuyển đổi thấp (${(switchRate * 100).toFixed(1)}%), dự đoán theo kết quả trước đó`
        };
    }
    
    // Phân tích mẫu 3 kỳ gần nhất
    if (lastThree.every(r => r === 'T')) {
        return {
            predictTai: false,
            confidence: 0.75,
            method: "AdaptivePattern_AfterTripleT",
            reason: "Sau 3 lần Tài liên tiếp, dự đoán đảo chiều sang Xỉu"
        };
    } else if (lastThree.every(r => r === 'X')) {
        return {
            predictTai: true,
            confidence: 0.75,
            method: "AdaptivePattern_AfterTripleX",
            reason: "Sau 3 lần Xỉu liên tiếp, dự đoán đảo chiều sang Tài"
        };
    }
    
    // Phân tích mẫu xen kẽ hoàn hảo
    if (lastFive.length >= 4) {
        const isAlternating = isAlternatingPattern(lastFive.slice(0, 4));
        if (isAlternating) {
            const nextIsT = lastFive[0] === 'X';
            return {
                predictTai: nextIsT,
                confidence: 0.72,
                method: "AdaptivePattern_PerfectAlternating",
                reason: `Mẫu xen kẽ hoàn hảo, dự đoán tiếp theo là ${nextIsT ? 'Tài' : 'Xỉu'}`
            };
        }
    }
    
    // Trường hợp không phát hiện mẫu đặc biệt nhưng có xu hướng rõ ràng
    const dominanceThreshold = 0.65; // Ngưỡng để xác định xu hướng
    const taiRatio = taiCount / resultPattern.length;
    
    if (taiRatio >= dominanceThreshold) {
        // Xu hướng Tài mạnh
        return {
            predictTai: Math.random() < 0.85, // Có 85% khả năng tiếp tục theo xu hướng
            confidence: 0.65 + (taiRatio - dominanceThreshold) * 2,
            method: "AdaptivePattern_TaiDominance",
            reason: `Xu hướng Tài mạnh (${(taiRatio * 100).toFixed(1)}%)`
        };
    } else if (taiRatio <= (1 - dominanceThreshold)) {
        // Xu hướng Xỉu mạnh
        return {
            predictTai: Math.random() < 0.15, // Có 15% khả năng đi ngược xu hướng
            confidence: 0.65 + ((1 - dominanceThreshold) - taiRatio) * 2,
            method: "AdaptivePattern_XiuDominance",
            reason: `Xu hướng Xỉu mạnh (${((1 - taiRatio) * 100).toFixed(1)}%)`
        };
    }
    
    // Trường hợp không có mẫu rõ ràng
    return {
        predictTai: Math.random() >= 0.5,
        confidence: 0.5,
        method: "AdaptivePattern_Balanced",
        reason: "Không phát hiện mẫu rõ ràng, dự đoán cân bằng"
    };
}

/**
 * Phân tích các mẫu đặc biệt từ cấu hình
 * @param {Array} pattern - Mảng mẫu T/X
 * @returns {Object} Kết quả phân tích
 */
function analyzeSpecialPatterns(pattern) {
    if (!pattern || pattern.length < 4) {
        return { detected: false };
    }
    
    const patternStr = pattern.slice(0, 5).join('');
    const specialPatterns = config.patternBreakers.specialPatterns;
    
    for (const [key, value] of Object.entries(specialPatterns)) {
        if (patternStr.startsWith(key)) {
            // Cập nhật thống kê cho mẫu đặc biệt này
            if (!specialPatternStats[key]) {
                specialPatternStats[key] = { hits: 0, misses: 0 };
            }
            
            return {
                detected: true,
                pattern: key,
                predictTai: value.value === 'T',
                confidence: value.confidence,
                method: "AdaptivePattern_Special",
                reason: `Phát hiện mẫu đặc biệt ${key}, dự đoán ${value.value}`
            };
        }
    }
    
    return { detected: false };
}

/**
 * Phát hiện và xử lý chuỗi thất bại liên tiếp
 * @param {Array} pattern - Mảng mẫu T/X
 * @param {Array} predictions - Lịch sử dự đoán gần đây
 * @returns {Object} Kết quả xử lý
 */
function detectAndHandleStreaks(pattern, predictions) {
    if (!predictions || predictions.length < 3) {
        return { confidence: 0 };
    }
    
    // Đếm số lần dự đoán sai liên tiếp
    let consecutiveFailures = 0;
    for (let i = 0; i < predictions.length; i++) {
        if (predictions[i].success === false) {
            consecutiveFailures++;
        } else {
            break;
        }
    }
    
    if (consecutiveFailures >= config.streakBreaker.maxConsecutiveFailures) {
        // Khi có chuỗi thất bại, đảo ngược dự đoán
        const lastPrediction = predictions[0];
        
        if (config.streakBreaker.reverseAfterStreak) {
            return {
                predictTai: !lastPrediction.predictTai,
                confidence: 0.78,
                method: "AdaptivePattern_StreakBreaker",
                reason: `Đảo chiều sau ${consecutiveFailures} lần dự đoán sai liên tiếp`,
                streakType: "FailureReversal"
            };
        }
    }
    
    // Phát hiện chuỗi Tài/Xỉu dài
    let taiStreak = 0;
    let xiuStreak = 0;
    
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === 'T') {
            taiStreak++;
            xiuStreak = 0;
        } else {
            xiuStreak++;
            taiStreak = 0;
        }
        
        if (taiStreak >= 4) {
            return {
                predictTai: false,
                confidence: 0.82,
                method: "AdaptivePattern_LongTaiStreak",
                reason: `Phát hiện chuỗi ${taiStreak} Tài liên tiếp, dự đoán đảo chiều`,
                streakType: "TaiStreak"
            };
        } else if (xiuStreak >= 4) {
            return {
                predictTai: true,
                confidence: 0.82,
                method: "AdaptivePattern_LongXiuStreak",
                reason: `Phát hiện chuỗi ${xiuStreak} Xỉu liên tiếp, dự đoán đảo chiều`,
                streakType: "XiuStreak"
            };
        }
    }
    
    return { confidence: 0 };
}

/**
 * Phân tích mẫu theo thời gian
 * @param {Array} results - Kết quả lịch sử
 * @returns {Object} Kết quả phân tích
 */
function analyzeTimePatterns(results) {
    if (!results || results.length < 5) {
        return { confidence: 0 };
    }
    
    try {
        // Lấy thời gian hiện tại
        const now = new Date();
        const currentHour = now.getHours();
        
        // Xác định khoảng thời gian trong ngày
        let timeOfDay;
        if (currentHour >= 5 && currentHour < 11) {
            timeOfDay = 'morning';       // Sáng: 05:00 - 11:00
        } else if (currentHour >= 11 && currentHour < 13) {
            timeOfDay = 'noon';          // Trưa: 11:00 - 13:00
        } else if (currentHour >= 13 && currentHour < 18) {
            timeOfDay = 'afternoon';     // Chiều: 13:00 - 18:00
        } else if (currentHour >= 18 && currentHour < 22) {
            timeOfDay = 'evening';       // Tối: 18:00 - 22:00
        } else {
            timeOfDay = 'latenight';     // Khuya: 22:00 - 05:00
        }
        
        // Nếu không có dữ liệu về hiệu suất theo thời gian, tạo mới
        if (!timePerformanceData[timeOfDay]) {
            timePerformanceData[timeOfDay] = {
                taiCount: 0,
                xiuCount: 0,
                lastTenResults: []
            };
        }
        
        // Cập nhật dữ liệu theo thời gian với kết quả mới nhất
        const latestResult = results[0].numbers[0] >= 5 ? 'T' : 'X';
        
        timePerformanceData[timeOfDay].lastTenResults.unshift(latestResult);
        if (timePerformanceData[timeOfDay].lastTenResults.length > 10) {
            timePerformanceData[timeOfDay].lastTenResults.pop();
        }
        
        if (latestResult === 'T') {
            timePerformanceData[timeOfDay].taiCount++;
        } else {
            timePerformanceData[timeOfDay].xiuCount++;
        }
        
        // Phân tích xu hướng theo thời gian
        const lastTenResults = timePerformanceData[timeOfDay].lastTenResults;
        const taiRatio = lastTenResults.filter(r => r === 'T').length / lastTenResults.length;
        
        // Có mẫu rõ ràng theo thời gian
        if (taiRatio >= 0.7) {
            return {
                predictTai: true,
                confidence: Math.min(0.7 + (taiRatio - 0.7) * 2, 0.85),
                method: "AdaptivePattern_TimeBasedTai",
                reason: `Xu hướng Tài mạnh (${(taiRatio * 100).toFixed(1)}%) trong khung giờ ${timeOfDay}`,
                timePattern: `${timeOfDay}_taiDominant`
            };
        } else if (taiRatio <= 0.3) {
            return {
                predictTai: false,
                confidence: Math.min(0.7 + (0.3 - taiRatio) * 2, 0.85),
                method: "AdaptivePattern_TimeBasedXiu",
                reason: `Xu hướng Xỉu mạnh (${((1 - taiRatio) * 100).toFixed(1)}%) trong khung giờ ${timeOfDay}`,
                timePattern: `${timeOfDay}_xiuDominant`
            };
        }
        
        return { confidence: 0 };
    } catch (error) {
        console.error(`Lỗi khi phân tích theo thời gian: ${error.message}`);
        return { confidence: 0 };
    }
}

/**
 * Phân tích biến động trong kết quả
 * @param {Array} pattern - Mảng mẫu T/X
 * @returns {Object} Kết quả phân tích
 */
function analyzeVolatility(pattern) {
    if (!pattern || pattern.length < 5) {
        return { volatilityDetected: false };
    }
    
    // Đếm số lần chuyển đổi trong 5 kỳ gần nhất
    let switchCount = 0;
    for (let i = 1; i < 5; i++) {
        if (pattern[i] !== pattern[i - 1]) {
            switchCount++;
        }
    }
    
    // Biến động cao: nhiều chuyển đổi
    if (switchCount >= 4) {
        return {
            volatilityDetected: true,
            volatilityLevel: "high",
            predictTai: pattern[0] !== pattern[1], // Dự đoán ngược với mẫu biến động
            confidence: 0.7,
            reason: "Biến động cao, theo xu hướng đảo chiều"
        };
    }
    
    // Biến động thấp: ít hoặc không có chuyển đổi
    if (switchCount <= 1) {
        const dominantResult = pattern.slice(0, 3).filter(r => r === 'T').length >= 2 ? 'T' : 'X';
        
        return {
            volatilityDetected: true,
            volatilityLevel: "low",
            predictTai: dominantResult === 'T',
            confidence: 0.75,
            reason: `Biến động thấp, theo xu hướng chủ đạo ${dominantResult}`
        };
    }
    
    return { volatilityDetected: false };
}

/**
 * Kiểm tra mẫu xen kẽ
 * @param {Array} pattern - Mảng mẫu cần kiểm tra
 * @returns {Boolean} Có phải mẫu xen kẽ không
 */
function isAlternatingPattern(pattern) {
    if (pattern.length < 3) return false;
    
    for (let i = 1; i < pattern.length; i++) {
        if (pattern[i] === pattern[i - 1]) {
            return false;
        }
    }
    
    return true;
}

/**
 * Cập nhật kết quả dự đoán gần đây
 * @param {Object} prediction - Dự đoán mới
 * @param {Boolean} success - Kết quả dự đoán (đúng/sai)
 */
function updateRecentPredictions(prediction, success) {
    if (!prediction) return;
    
    // Thêm kết quả mới vào đầu danh sách
    recentPredictions.unshift({
        method: prediction.method,
        predictTai: prediction.predictTai,
        confidence: prediction.confidence,
        success: success,
        timestamp: new Date().toISOString()
    });
    
    // Giới hạn danh sách ở 20 kỳ gần nhất
    if (recentPredictions.length > 20) {
        recentPredictions.pop();
    }
    
    // Cập nhật cache hiệu suất phương pháp
    if (!methodPerformanceCache[prediction.method]) {
        methodPerformanceCache[prediction.method] = { correct: 0, total: 0 };
    }
    
    methodPerformanceCache[prediction.method].total++;
    if (success) {
        methodPerformanceCache[prediction.method].correct++;
    }
    
    // Cập nhật cache phát hiện chuỗi
    const method = prediction.method;
    if (!streakDetectionCache[method]) {
        streakDetectionCache[method] = {
            currentStreak: 0,
            streakType: null,
            longestWinStreak: 0,
            longestLoseStreak: 0
        };
    }
    
    // Cập nhật chuỗi hiện tại
    if (success) {
        if (streakDetectionCache[method].streakType === 'win') {
            streakDetectionCache[method].currentStreak++;
        } else {
            streakDetectionCache[method].streakType = 'win';
            streakDetectionCache[method].currentStreak = 1;
        }
        
        // Cập nhật chuỗi thắng dài nhất
        if (streakDetectionCache[method].currentStreak > streakDetectionCache[method].longestWinStreak) {
            streakDetectionCache[method].longestWinStreak = streakDetectionCache[method].currentStreak;
        }
    } else {
        if (streakDetectionCache[method].streakType === 'lose') {
            streakDetectionCache[method].currentStreak++;
        } else {
            streakDetectionCache[method].streakType = 'lose';
            streakDetectionCache[method].currentStreak = 1;
        }
        
        // Cập nhật chuỗi thua dài nhất
        if (streakDetectionCache[method].currentStreak > streakDetectionCache[method].longestLoseStreak) {
            streakDetectionCache[method].longestLoseStreak = streakDetectionCache[method].currentStreak;
        }
    }
}

// Xuất các hàm để sử dụng ở nơi khác
module.exports = {
    detectAdaptivePattern,
    updateRecentPredictions
}; 