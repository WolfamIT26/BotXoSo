/**
 * BetBreaker - Module xử lý chuyên biệt cho chuỗi bệt tài/xỉu
 * Phiên bản: v2.0.0
 * 
 * Module này nhằm:
 * 1. Phát hiện sớm và chính xác chuỗi bệt tài/xỉu
 * 2. Áp dụng chiến lược đối phó phù hợp với từng loại chuỗi bệt
 * 3. Phân tích hiệu suất và tự điều chỉnh chiến lược
 * 4. Kết hợp phân tích thời gian và mẫu đặc biệt
 * 5. Xử lý thích ứng cho chuỗi thua dài
 * 6. Học máy từ mẫu phức tạp
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Cache lưu trữ tạm thời
const betStreakCache = {
    recentStreak: null,
    recentDetections: [],
    followStreak: null,
    followStreakFailures: 0,
    reversalCount: 0,
    lastReversalTime: 0,
    consecutiveLosses: 0
};

// Biến theo dõi hiệu suất đơn giản
let betPerformanceStats = {
    T: { total: 0, correct: 0 },
    X: { total: 0, correct: 0 },
    unknown: { total: 0, correct: 0 }
};

/**
 * Phát hiện chuỗi bệt tài/xỉu từ lịch sử
 * @param {Array} history - Mảng lịch sử kết quả
 * @param {Number} index - Vị trí cần dự đoán (thường là 0)
 * @returns {Object} Kết quả phát hiện
 */
function detectBetStreak(history, index = 0) {
    if (!config.betDetector || !config.betDetector.enabled || !history || history.length < 3) {
        return { detected: false };
    }
    
    try {
        // Chuyển đổi lịch sử thành chuỗi 'T' và 'X'
        const recentResults = history.slice(0, config.betDetector.detection.detectionWindowSize)
            .map(item => item.numbers[index] >= 5 ? 'T' : 'X');
        
        // Kiểm tra các tham số cấu hình
        const { minBetLength, earlyDetectionThreshold, confidentBetLength } = config.betDetector.detection;
        
        // Phân tích chuỗi hiện tại
        const currentStreak = analyzeCurrentStreak(recentResults);
        
        // Lưu cache
        betStreakCache.recentStreak = currentStreak;
        
        // Không đủ để xác định chuỗi bệt
        if (currentStreak.length < earlyDetectionThreshold) {
            return { detected: false };
        }
        
        // Mới: Phân tích xu hướng dài hạn
        const longTermTrend = analyzeLongTermTrend(recentResults, 10);
        if (longTermTrend.detected) {
            return {
                detected: true,
                betStreak: true,
                streakType: longTermTrend.dominantType,
                streakLength: longTermTrend.count,
                predictTai: longTermTrend.dominantType === 'X', // Dự đoán ngược với xu hướng chủ đạo
                confidence: 0.82,
                method: 'BetBreaker_LongTerm',
                reason: `Phát hiện xu hướng dài hạn ${longTermTrend.dominantType === 'T' ? 'Tài' : 'Xỉu'} (${longTermTrend.percentage.toFixed(1)}%), dự đoán ngược lại`
            };
        }
        
        // Xử lý phát hiện chuỗi bệt đặc biệt
        const specialBetPattern = detectSpecialBetPattern(recentResults);
        if (specialBetPattern.detected) {
            return specialBetPattern;
        }
        
        // Phát hiện chuỗi bệt tiêu chuẩn
        if (currentStreak.length >= minBetLength) {
            // Giờ hiện tại để kiểm tra chuỗi bệt theo giờ
            const currentHour = new Date().getHours();
            const isInBetTaiHours = config.betDetector.detection.checkSpecialHours && 
                                  config.betDetector.detection.betTaiHours.includes(currentHour);
            const isInBetXiuHours = config.betDetector.detection.checkSpecialHours && 
                                  config.betDetector.detection.betXiuHours.includes(currentHour);
            
            // Tính độ tin cậy dựa trên độ dài chuỗi
            let confidence = calculateBetConfidence(currentStreak);
            
            // Điều chỉnh độ tin cậy dựa trên giờ
            if (currentStreak.type === 'T' && isInBetTaiHours) {
                confidence += 0.05;
            } else if (currentStreak.type === 'X' && isInBetXiuHours) {
                confidence += 0.05;
            }
            
            // Mới: Kiểm tra xem có nên áp dụng độ tin cậy tăng cường cho chuỗi thua dài hay không
            if (config.streakBreaker && config.streakBreaker.adaptiveReversal && 
                config.streakBreaker.adaptiveReversal.enabled &&
                currentStreak.length >= config.streakBreaker.longLossThreshold) {
                confidence = Math.min(0.95, confidence + config.streakBreaker.adaptiveReversal.confidenceBoost);
            }
            
            // Tạo dự đoán dựa trên chuỗi bệt
            return createBetPrediction(currentStreak, confidence);
        }
        
        // Phát hiện sớm chuỗi bệt
        if (currentStreak.length >= earlyDetectionThreshold) {
            // Kiểm tra giờ đặc biệt để phát hiện sớm
            const currentHour = new Date().getHours();
            const isBetTaiHourEarly = config.betDetector.detection.betTaiHours.includes(currentHour);
            const isBetXiuHourEarly = config.betDetector.detection.betXiuHours.includes(currentHour);
            
            // Các điều kiện phát hiện sớm
            if ((currentStreak.type === 'T' && isBetTaiHourEarly) || 
                (currentStreak.type === 'X' && isBetXiuHourEarly)) {
                    
                const earlyConfidence = config.betDetector.strategy.earlyDetectionConfidence;
                return createBetPrediction(currentStreak, earlyConfidence, true);
            }
        }
        
        return { detected: false };
    } catch (error) {
        console.error(`Lỗi khi phát hiện chuỗi bệt: ${error.message}`);
        return { detected: false };
    }
}

/**
 * Phân tích chuỗi hiện tại từ kết quả gần đây
 * @param {Array} results - Mảng kết quả T/X gần đây
 * @returns {Object} Thông tin về chuỗi hiện tại
 */
function analyzeCurrentStreak(results) {
    if (!results || results.length === 0) {
        return { type: null, length: 0 };
    }
    
    // Kiểm tra chuỗi Tài liên tiếp
    let taiStreak = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i] === 'T') {
            taiStreak++;
        } else {
            break;
        }
    }
    
    // Kiểm tra chuỗi Xỉu liên tiếp
    let xiuStreak = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i] === 'X') {
            xiuStreak++;
        } else {
            break;
        }
    }
    
    // Trả về chuỗi dài hơn
    if (taiStreak > xiuStreak) {
        return { type: 'T', length: taiStreak };
    } else if (xiuStreak > 0) {
        return { type: 'X', length: xiuStreak };
    } else {
        return { type: null, length: 0 };
    }
}

/**
 * Phát hiện mẫu chuỗi bệt đặc biệt
 * @param {Array} results - Mảng kết quả T/X gần đây
 * @returns {Object} Thông tin về mẫu đặc biệt nếu phát hiện
 */
function detectSpecialBetPattern(results) {
    if (!results || results.length < 3) {
        return { detected: false };
    }
    
    const patternStr = results.slice(0, 5).join('');
    const specialPatterns = config.betDetector.specialBetPatterns;
    
    for (const [pattern, patternConfig] of Object.entries(specialPatterns)) {
        if (patternStr.startsWith(pattern)) {
            // Xử lý hành động dựa trên cấu hình
            const isTaiStreak = pattern[0] === 'T';
            let predictTai;
            
            if (patternConfig.action === 'reverse') {
                predictTai = !isTaiStreak;
            } else if (patternConfig.action === 'continue') {
                predictTai = patternStr[patternStr.length - 1] === 'T';
            } else {
                continue; // Không hỗ trợ hành động này
            }
            
            return {
                detected: true,
                specialPattern: true,
                pattern,
                streakType: isTaiStreak ? 'T' : 'X',
                streakLength: pattern.length,
                predictTai,
                confidence: patternConfig.confidence,
                method: 'BetBreaker_SpecialPattern',
                reason: `Phát hiện mẫu bệt đặc biệt ${pattern}, ${patternConfig.action === 'reverse' ? 'đảo ngược' : 'tiếp tục'} thành ${predictTai ? 'Tài' : 'Xỉu'}`
            };
        }
    }
    
    return { detected: false };
}

/**
 * Tính toán độ tin cậy dựa trên độ dài chuỗi bệt
 * @param {Object} streak - Thông tin chuỗi bệt
 * @returns {Number} Độ tin cậy
 */
function calculateBetConfidence(streak) {
    const { minBetLength, confidentBetLength } = config.betDetector.detection;
    const { earlyDetectionConfidence, confidentDetectionConfidence } = config.betDetector.strategy;
    
    // Chuỗi chắc chắn
    if (streak.length >= confidentBetLength) {
        return confidentDetectionConfidence;
    }
    
    // Chuỗi vừa phải
    if (streak.length >= minBetLength) {
        // Tính độ tin cậy theo thang từ earlyDetectionConfidence đến confidentDetectionConfidence
        const confidenceRange = confidentDetectionConfidence - earlyDetectionConfidence;
        const lengthRange = confidentBetLength - minBetLength;
        const lengthFactor = (streak.length - minBetLength) / lengthRange;
        
        return earlyDetectionConfidence + (confidenceRange * lengthFactor);
    }
    
    // Chuỗi ngắn
    return earlyDetectionConfidence;
}

/**
 * Phân tích xu hướng dài hạn từ lịch sử
 * @param {Array} results - Mảng kết quả gần đây
 * @param {Number} lookbackCount - Số kỳ xem xét
 * @returns {Object} Thông tin về xu hướng
 */
function analyzeLongTermTrend(results, lookbackCount = 10) {
    if (!results || results.length < lookbackCount) {
        return { detected: false };
    }
    
    const sampleData = results.slice(0, lookbackCount);
    let taiCount = 0;
    let xiuCount = 0;
    
    // Đếm số lần xuất hiện Tài/Xỉu
    for (const result of sampleData) {
        if (result === 'T') {
            taiCount++;
        } else {
            xiuCount++;
        }
    }
    
    // Phân tích xu hướng chủ đạo
    const total = taiCount + xiuCount;
    const taiPercentage = (taiCount / total) * 100;
    const xiuPercentage = (xiuCount / total) * 100;
    
    // Xác định xu hướng nếu một bên chiếm trên 70%
    if (taiPercentage >= 70) {
        return {
            detected: true,
            dominantType: 'T',
            count: taiCount,
            percentage: taiPercentage
        };
    } else if (xiuPercentage >= 70) {
        return {
            detected: true,
            dominantType: 'X',
            count: xiuCount,
            percentage: xiuPercentage
        };
    }
    
    return { detected: false };
}

/**
 * Tạo dự đoán dựa trên chuỗi bệt phát hiện được
 * @param {Object} streak - Thông tin chuỗi bệt
 * @param {Number} confidence - Độ tin cậy
 * @param {Boolean} isEarlyDetection - Đánh dấu phát hiện sớm
 * @returns {Object} Dự đoán
 */
function createBetPrediction(streak, confidence, isEarlyDetection = false) {
    // Tính toán dự đoán dựa trên chuỗi bệt hiện tại
    // Mặc định: nếu chuỗi là Xỉu, dự đoán Tài và ngược lại
    const predictTai = streak.type === 'X'; 
    const streakType = streak.type === 'T' ? 'Tài' : 'Xỉu';
    const isConfident = streak.length >= config.betDetector.detection.confidentBetLength;
    
    // Kiểm tra xem có nên đảo ngược không
    const shouldReverse = config.betDetector.strategy.reverseAfterBet;
    
    // Cập nhật thống kê phát hiện
    betStreakCache.recentDetections.push({
        time: new Date(),
        streakType: streak.type,
        streakLength: streak.length,
        prediction: predictTai ? 'T' : 'X'
    });
    
    // Giữ tối đa 10 phát hiện gần nhất
    if (betStreakCache.recentDetections.length > 10) {
        betStreakCache.recentDetections.shift();
    }
    
    // Kiểm tra cấu hình mới về việc duy trì hướng đặt cược
    const shouldMaintainDirection = config.streakBreaker && 
                                  config.streakBreaker.maintainDirectionAfterLosses && 
                                  streak.length >= config.streakBreaker.longLossThreshold;
    
    // Mới: Kiểm tra xem đây có phải là thời điểm đảo ngược thích ứng không
    const shouldAdaptivelyReverse = shouldUseAdaptiveReversal(streak);
    
    let finalPrediction;
    let actionDescription;
    let method = 'BetBreaker' + (isEarlyDetection ? '_Early' : '');
    
    if (shouldAdaptivelyReverse) {
        // Áp dụng chiến lược đảo ngược thích ứng
        finalPrediction = !predictTai;
        actionDescription = `đảo ngược thích ứng (lần thứ ${betStreakCache.reversalCount})`;
        method = 'BetBreaker_AdaptiveReversal';
        
        // Cập nhật thông tin về đảo ngược
        betStreakCache.reversalCount++;
        betStreakCache.lastReversalTime = Date.now();
    } else if (shouldMaintainDirection) {
        // Nếu là chuỗi thua dài, duy trì cùng hướng dự đoán
        finalPrediction = streak.type === 'T' ? false : true; // Dự đoán ngược với chuỗi hiện tại
        actionDescription = `duy trì hướng dự đoán ${finalPrediction ? 'Tài' : 'Xỉu'} (chuỗi thua dài ${streak.length} kỳ)`;
    } else {
        // Nếu không phải chuỗi thua dài, áp dụng chiến lược thông thường
        finalPrediction = shouldReverse ? predictTai : !predictTai;
        actionDescription = `${shouldReverse ? 'đảo ngược' : 'dự đoán cùng chiều'}`;
    }
    
    return {
        detected: true,
        betStreak: true,
        streakType: streak.type,
        streakLength: streak.length,
        predictTai: finalPrediction,
        confidence: confidence,
        method: method,
        reason: `Phát hiện chuỗi bệt ${streakType} ${streak.length} lần liên tiếp, ${actionDescription} thành ${finalPrediction ? 'Tài' : 'Xỉu'}`
    };
}

/**
 * Cập nhật thống kê hiệu suất xử lý chuỗi bệt
 * @param {Object} prediction - Thông tin dự đoán
 * @param {boolean} isCorrect - Kết quả dự đoán đúng hay sai
 */
function updateBetPerformance(prediction, isCorrect) {
    // Chỉ theo dõi trong bộ nhớ, không lưu file
    if (!prediction) {
        return;
    }
    
    // Cập nhật biến theo dõi chuỗi thua
    if (!isCorrect) {
        betStreakCache.consecutiveLosses++;
    } else {
        betStreakCache.consecutiveLosses = 0;
    }
    
    // Xử lý đặc biệt cho trường hợp theo dõi chuỗi bệt
    if (prediction.followingStreak) {
        // Cập nhật số lần thất bại liên tiếp khi theo chuỗi bệt
        if (!isCorrect) {
            betStreakCache.followStreakFailures++;
            console.log(`⚠️ Thất bại khi theo chuỗi bệt ${betStreakCache.followStreak}: ${betStreakCache.followStreakFailures}/${config.betStreakFollower.maxConsecutiveFailures}`);
        } else {
            // Reset số lần thất bại nếu đúng
            betStreakCache.followStreakFailures = 0;
            console.log(`✅ Dự đoán đúng khi theo chuỗi bệt ${betStreakCache.followStreak}`);
        }
        
        return;
    }
    
    // Xử lý đặc biệt cho trường hợp đảo ngược thích ứng
    if (prediction.method === 'BetBreaker_AdaptiveReversal') {
        // Nếu đoán sai, có thể cần tăng ngưỡng tin cậy
        if (!isCorrect) {
            console.log(`⚠️ Thất bại khi sử dụng đảo ngược thích ứng lần thứ ${betStreakCache.reversalCount-1}`);
        } else {
            console.log(`✅ Dự đoán đúng khi sử dụng đảo ngược thích ứng lần thứ ${betStreakCache.reversalCount-1}`);
        }
    }
    
    // Xử lý thông thường cho chuỗi bệt
    if (!prediction.betStreak) {
        return;
    }
    
    // Cấu trúc thông tin chuỗi bệt
    const streakKey = prediction.streakType || "unknown";
    
    // Tăng số lượng tổng thể
    betPerformanceStats[streakKey].total++;
    if (isCorrect) {
        betPerformanceStats[streakKey].correct++;
    }
}

/**
 * Kiểm tra xem có nên sử dụng chiến lược đảo ngược thích ứng không
 * @param {Object} streak - Thông tin chuỗi bệt hiện tại
 * @returns {boolean} Có nên sử dụng đảo ngược thích ứng
 */
function shouldUseAdaptiveReversal(streak) {
    // Kiểm tra xem tính năng đảo ngược thích ứng có được bật không
    if (!config.streakBreaker || !config.streakBreaker.adaptiveReversal || 
        !config.streakBreaker.adaptiveReversal.enabled) {
        return false;
    }
    
    // Kiểm tra số lần thua liên tiếp
    if (betStreakCache.consecutiveLosses < config.streakBreaker.adaptiveReversal.activateAfterLosses) {
        return false;
    }
    
    // Kiểm tra khoảng thời gian giữa các lần đảo ngược
    const now = Date.now();
    const timeSinceLastReversal = now - betStreakCache.lastReversalTime;
    
    if (betStreakCache.lastReversalTime > 0 && 
        timeSinceLastReversal < config.streakBreaker.adaptiveReversal.minTimeBetweenReversals) {
        return false;
    }
    
    // Kiểm tra số lần đảo ngược tối đa
    if (betStreakCache.reversalCount >= config.streakBreaker.adaptiveReversal.maxReversals) {
        return false;
    }
    
    return true;
}

/**
 * Phát hiện và theo dõi chuỗi bệt sau khi thua liên tiếp
 * @param {Array} history - Mảng lịch sử kết quả
 * @param {Number} recentLosses - Số lần thua liên tiếp
 * @param {Number} index - Vị trí cần dự đoán (thường là 0)
 * @returns {Object} Kết quả phát hiện và dự đoán
 */
function detectAndFollowBetStreak(history, recentLosses, index = 0) {
    if (!config.betStreakFollower || !config.betStreakFollower.enabled || !history || history.length < 3) {
        return { detected: false };
    }
    
    // Chỉ kích hoạt khi đủ số lần thua liên tiếp
    if (recentLosses < config.betStreakFollower.activateAfterLosses) {
        return { detected: false };
    }
    
    try {
        // Chuyển đổi lịch sử thành chuỗi 'T' và 'X'
        const recentResults = history.slice(0, Math.max(5, config.betDetector.detection.detectionWindowSize))
            .map(item => item.numbers[index] >= 5 ? 'T' : 'X');
        
        // Kiểm tra xem đã có thất bại quá số lần cho phép khi theo chuỗi bệt không
        if (betStreakCache.followStreak && betStreakCache.followStreakFailures >= config.betStreakFollower.maxConsecutiveFailures) {
            if (betStreakCache.followStreak) {
                console.log(`ℹ️ Ngừng theo chuỗi bệt ${betStreakCache.followStreak} sau ${betStreakCache.followStreakFailures} lần thất bại`);
                betStreakCache.followStreak = null;
                betStreakCache.followStreakFailures = 0;
            }
            return { detected: false };
        }
        
        // Nếu đang theo dõi chuỗi bệt, tiếp tục theo dõi
        if (betStreakCache.followStreak) {
            const streakType = betStreakCache.followStreak;
            const streakTypeText = streakType === 'T' ? 'Tài' : 'Xỉu';
            
            // Mới: Kiểm tra xem có học thích ứng không
            let confidence = config.betStreakFollower.confidence;
            let method = 'BetStreakFollower';
            let additionalInfo = '';
            
            if (config.betStreakFollower.adaptiveLearning && 
                config.betStreakFollower.adaptiveLearning.enabled) {
                // Điều chỉnh độ tin cậy dựa trên hiệu suất trước đó
                if (betStreakCache.followStreakFailures === 0) {
                    confidence = Math.min(0.95, confidence + 0.05);
                    additionalInfo = ', độ tin cậy tăng';
                } else {
                    confidence = Math.max(0.65, confidence - (0.03 * betStreakCache.followStreakFailures));
                    additionalInfo = ', độ tin cậy giảm';
                }
                method = 'AdaptiveStreakFollower';
            }
            
            return {
                detected: true,
                betStreak: true,
                streakType: streakType,
                followingStreak: true,
                predictTai: streakType === 'T', // Dự đoán theo chuỗi bệt
                confidence: confidence,
                method: method,
                reason: `Tiếp tục theo chuỗi bệt ${streakTypeText} sau ${recentLosses} lần thua liên tiếp${additionalInfo}`
            };
        }
        
        // Phân tích chuỗi hiện tại từ kết quả thực tế gần đây
        let currentStreak = null;
        
        // Đếm số lần xuất hiện liên tiếp của Tài hoặc Xỉu từ kết quả gần nhất
        let taiStreak = 0;
        for (let i = 0; i < recentResults.length; i++) {
            if (recentResults[i] === 'T') {
                taiStreak++;
            } else {
                break;
            }
        }
        
        let xiuStreak = 0;
        for (let i = 0; i < recentResults.length; i++) {
            if (recentResults[i] === 'X') {
                xiuStreak++;
            } else {
                break;
            }
        }
        
        // Mới: Kiểm tra xem có nên yêu cầu chuỗi bệt tự tin không
        const minLength = config.betStreakFollower.requireConfidentStreak ? 
            Math.max(config.betStreakFollower.minBetLength, 3) : 
            config.betStreakFollower.minBetLength;
        
        // Xác định chuỗi bệt hiện tại
        if (taiStreak >= minLength) {
            currentStreak = { type: 'T', length: taiStreak };
        } else if (xiuStreak >= minLength) {
            currentStreak = { type: 'X', length: xiuStreak };
        }
        
        // Nếu phát hiện chuỗi bệt đủ dài
        if (currentStreak && currentStreak.length >= minLength) {
            // Lưu vào cache để theo dõi
            betStreakCache.followStreak = currentStreak.type;
            betStreakCache.followStreakFailures = 0;
            
            const streakTypeText = currentStreak.type === 'T' ? 'Tài' : 'Xỉu';
            
            return {
                detected: true,
                betStreak: true,
                streakType: currentStreak.type,
                streakLength: currentStreak.length,
                followingStreak: true,
                predictTai: currentStreak.type === 'T', // Dự đoán THEO chuỗi bệt, không đảo ngược
                confidence: config.betStreakFollower.confidence,
                method: 'BetStreakFollower',
                reason: `Bắt đầu theo chuỗi bệt ${streakTypeText} ${currentStreak.length} lần liên tiếp sau ${recentLosses} lần thua`
            };
        }
        
        return { detected: false };
    } catch (error) {
        console.error(`Lỗi khi phát hiện chuỗi bệt để theo dõi: ${error.message}`);
        return { detected: false };
    }
}

/**
 * Trích xuất hướng dự đoán trước đó từ file log
 * @param {string} logFile - Đường dẫn tới file log dự đoán
 * @param {number} lines - Số dòng tối đa cần đọc (mặc định: 5)
 * @returns {string|null} - Trả về 'T', 'X', hoặc null nếu không tìm thấy
 */
function getPreviousPredictionDirection(logFile, lines = 5) {
    if (!fs.existsSync(logFile)) return null;
    
    try {
        // Đọc một số dòng gần nhất từ file log
        const data = fs.readFileSync(logFile, 'utf8');
        const recentLines = data.split('\n').filter(line => line.trim()).slice(0, lines);
        
        // Tìm dự đoán gần nhất
        for (const line of recentLines) {
            if (line.includes('Dự đoán: Tài')) {
                return 'T';
            } else if (line.includes('Dự đoán: Xỉu')) {
                return 'X';
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Lỗi khi đọc hướng dự đoán trước đó: ${error.message}`);
        return null;
    }
}

module.exports = {
    detectBetStreak,
    updateBetPerformance,
    detectAndFollowBetStreak,
    getPreviousPredictionDirection,
    shouldUseAdaptiveReversal
}; 