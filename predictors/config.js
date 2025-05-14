/**
 * File cấu hình thống nhất cho hệ thống dự đoán
 * Phiên bản: v6.4.0
 */

const CONFIG = {
    // Thông tin phiên bản
    version: "v6.4.0",
    
    // Trọng số cho các thuật toán - dựa trên phân tích hiệu suất
    defaultWeights: {
        AdvancedCombination: 0.28,       // Giảm từ 0.30 xuống 0.28 (nhường trọng số cho các phương pháp mới)
        ShortAlternatingPattern: 0.15,   // Giữ nguyên 0.15
        CyclicalPattern: 0.13,           // Giảm từ 0.15 xuống 0.13
        BetBreaker: 0.15,                // Giữ nguyên 0.15 (hiệu suất cao 83%)
        BetStreakFollower: 0.10,         // Giữ nguyên 0.10
        FastPatternDetector: 0.08,       // Giữ nguyên 0.08
        TimeBasedPattern: 0.04,          // Giữ nguyên 0.04
        LongStreakPattern: 0.03,         // Giữ nguyên 0.03
        AdaptivePatternRecognition: 0.00, // Giữ nguyên 0.00
        TimeAnalysis: 0.02,              // Mới: 0.02
        AdaptiveLearning: 0.01,          // Mới: 0.01 (khởi đầu thấp để tăng dần theo hiệu suất)
        StatisticalRegression: 0.01      // Mới: 0.01 (khởi đầu thấp để tăng dần theo hiệu suất)
    },
    
    // Cấu hình phân tích
    analysis: {
        historyLimit: 10,             // Giữ nguyên 10 kỳ
        minimumHistoryRequired: 5,    // Giữ nguyên min 5 kỳ để bắt đầu
        confidenceThreshold: 0.68,    // Giữ nguyên 0.68
        dynamicThreshold: true,       // Giữ tính năng ngưỡng tin cậy động theo giờ
        peakHoursThreshold: 0.65,     // Giữ nguyên 0.65
        peakHoursStart: 18,           // Giữ nguyên
        peakHoursEnd: 22,             // Giữ nguyên
        // Phân tích xu hướng thống kê
        statisticalAnalysis: {
            enabled: true,
            regressionThreshold: 0.2,   // Ngưỡng độ lệch để kích hoạt dự đoán hồi quy
            windowSize: 30,             // Kích thước cửa sổ phân tích xu hướng
            minConfidence: 0.65,        // Độ tin cậy tối thiểu
            maxConfidence: 0.85         // Độ tin cậy tối đa
        }
    },
    
    // Cấu hình ghi log
    logging: {
        detailedLogs: true,
        predictionLogFile: './data/prediction_log.txt',
        reversalLogFile: './data/prediction_reversal_log.txt', // Mới: Ghi log đảo ngược dự đoán
        performanceLogFile: './data/performance_log.txt'       // Mới: Ghi log hiệu suất
    },
    
    // Cấu hình đặt cược
    betting: {
        initialBalance: 10000000,
        defaultBetAmount: 100000,
        maxConsecutiveLosses: 3,           // Giữ nguyên do phân tích cho thấy có tối đa 5 lần thua liên tiếp
        winMultiplier: 1.95,
        enableProgressiveBetting: true,
        betMultiplierAfterLoss: 1.3,       // Giữ nguyên 1.3
        enableSelective: true,
        maximumDailyBets: 200,             // Giữ nguyên 200
        restPeriodAfterLosses: 7,          // Giữ nguyên 7
        useKellyCriterion: true,
        kellyFraction: 0.25,               // Giữ nguyên - cẩn trọng với quản lý vốn
        maxRiskPerBet: 0.03,               // Giữ nguyên - giảm rủi ro
        timeBasedBetting: true,            // Giữ nguyên
        morningBetMultiplier: 1.0,         // Giữ nguyên 1.0
        afternoonBetMultiplier: 0.8,       // Giữ nguyên 0.8
        eveningBetMultiplier: 1.0,         // Giữ nguyên 1.0
        nightBetMultiplier: 1.0,           // Giữ nguyên 1.0
        skipOnConsecutiveFailures: true,   // Giữ nguyên
        confidenceAdjustment: true,        // Giữ nguyên
        minConfidenceAfterLoss: 0.75,      // Giữ nguyên 0.75
        // Xử lý giai đoạn khó đoán
        difficultPeriodHandling: {
            enabled: true,
            accuracyThreshold: 0.4,        // Xem là giai đoạn khó nếu độ chính xác < 40%
            recentAccuracyThreshold: 0.45, // Ngưỡng hiệu suất gần đây để xác định giai đoạn khó
            confidenceThreshold: 0.75,     // Ngưỡng tin cậy tối thiểu trong giai đoạn khó
            betAmountMultiplier: 0.7,      // Giảm tiền cược còn 70%
            minAccuracyToBet: 0.35,        // Độ chính xác tối thiểu để đặt cược
            minSampleSize: 15              // Số mẫu tối thiểu để xác định độ chính xác
        }
    },
    
    // Cấu hình chống chuỗi thất bại liên tiếp
    streakBreaker: {
        enabled: true,
        maxConsecutiveFailures: 3,          // Giữ nguyên
        reverseAfterStreak: true,           // Giữ nguyên
        reversalScope: "all",               // Giữ nguyên
        maintainDirectionAfterLosses: true, // Giữ nguyên
        longLossThreshold: 5,               // Giữ nguyên 5
        consecutiveDirectionCount: 3,       // Giữ nguyên
        // Cải tiến xử lý đảo ngược thích ứng
        adaptiveReversal: {
            enabled: true,                  // Kích hoạt đảo ngược thích ứng
            activateAfterLosses: 4,         // Kích hoạt sau 4 lần thua liên tiếp
            confidenceBoost: 0.1,           // Tăng độ tin cậy thêm 10%
            maxReversals: 3,                // Số lần đảo ngược tối đa trong 1 phiên
            minTimeBetweenReversals: 300000 // Thời gian tối thiểu giữa các lần đảo ngược (ms)
        }
    },
    
    // Cấu hình theo dõi và đánh theo chuỗi bệt
    betStreakFollower: {
        enabled: true,
        activateAfterLosses: 2,          // Giữ nguyên 2
        maxConsecutiveFailures: 2,        // Giữ nguyên 2 
        minBetLength: 2,                  // Giữ nguyên 2
        confidence: 0.82,                 // Giữ nguyên 0.82
        priorityWeight: 0.65,             // Giữ nguyên 0.65
        requireConfidentStreak: false,    // Giữ nguyên
        // Học thích ứng từ lịch sử
        adaptiveLearning: {
            enabled: true,                // Kích hoạt học thích ứng
            historyWeightDecay: 0.9,      // Hệ số suy giảm trọng số theo thời gian
            minSamplesForAdjustment: 5,   // Số mẫu tối thiểu để điều chỉnh chiến lược
            confidenceIncrement: 0.02,    // Tăng độ tin cậy sau mỗi lần dự đoán đúng
            confidenceDecrement: 0.05,    // Giảm độ tin cậy sau mỗi lần dự đoán sai
            maxConfidence: 0.95,          // Độ tin cậy tối đa
            minConfidence: 0.65           // Độ tin cậy tối thiểu
        }
    },
    
    // Phát hiện và xử lý đặc biệt
    patternBreakers: {
        enabled: true,
        specialPatterns: {
            "TTT": { action: "predict", value: "X", confidence: 0.82 },
            "XXX": { action: "predict", value: "T", confidence: 0.82 },
            "TTTT": { action: "predict", value: "X", confidence: 0.85 },
            "XXXX": { action: "predict", value: "T", confidence: 0.85 },
            "TXTXT": { action: "predict", value: "X", confidence: 0.8 },
            "XTXTX": { action: "predict", value: "T", confidence: 0.8 },
            // Mẫu đặc biệt cho chuỗi bệt
            "TTTX": { action: "predict", value: "X", confidence: 0.83 },
            "XXXT": { action: "predict", value: "T", confidence: 0.83 },
            "TXTTXT": { action: "predict", value: "T", confidence: 0.81 },
            "XTXXTX": { action: "predict", value: "X", confidence: 0.81 }
        }
    },
    
    // Phát hiện và xử lý chuỗi bệt tài/xỉu
    betDetector: {
        enabled: true,
        // Phát hiện chuỗi bệt
        detection: {
            minBetLength: 3,                   // Giữ nguyên
            earlyDetectionThreshold: 2,        // Giữ nguyên
            detectionWindowSize: 5,            // Giữ nguyên
            confidentBetLength: 4,             // Giữ nguyên
            checkSpecialHours: true,           // Giữ nguyên
            betTaiHours: [16, 17, 19, 20],     // Giữ nguyên
            betXiuHours: [14, 15, 18, 21]      // Giữ nguyên
        },
        // Chiến lược đối phó
        strategy: {
            reverseAfterBet: true,             // Giữ nguyên
            increaseConfidence: true,          // Giữ nguyên
            confidenceBoost: 0.12,             // Giữ nguyên
            forceMethod: "BetBreaker",         // Giữ nguyên
            skipAfterIncorrect: 1,             // Giữ nguyên
            adaptiveInversion: true,           // Giữ nguyên
            earlyDetectionConfidence: 0.72,    // Giữ nguyên
            confidentDetectionConfidence: 0.85 // Giữ nguyên
        },
        // Phát hiện và xử lý chuỗi bệt đặc biệt
        specialBetPatterns: {
            "TTTTT": { action: "reverse", confidence: 0.90 },
            "XXXXX": { action: "reverse", confidence: 0.90 },
            "TTTTX": { action: "continue", confidence: 0.88 },
            "XXXXТ": { action: "continue", confidence: 0.88 }
        }
    },
    
    // Phân tích theo khung giờ
    timeAnalysis: {
        enabled: true,
        minSamplesRequired: 20,          // Số mẫu tối thiểu để áp dụng phân tích theo thời gian
        segments: {
            morning: { 
                enabled: true,
                defaultPredictTai: false,  // Mặc định dự đoán Xỉu vào buổi sáng
                confidenceBoost: 0.05      // Tăng độ tin cậy thêm 5%
            },
            afternoon: { 
                enabled: true,
                defaultPredictTai: true,   // Mặc định dự đoán Tài vào buổi trưa
                confidenceBoost: 0.02      // Tăng độ tin cậy thêm 2%
            },
            evening: { 
                enabled: true,
                defaultPredictTai: false,  // Mặc định dự đoán Xỉu vào buổi chiều
                confidenceBoost: 0.00      // Không điều chỉnh độ tin cậy
            },
            night: { 
                enabled: true,
                defaultPredictTai: true,   // Mặc định dự đoán Tài vào buổi tối
                confidenceBoost: 0.04      // Tăng độ tin cậy thêm 4%
            }
        }
    },
    
    // Phát hiện sự kiện đặc biệt
    specialEventDetection: {
        enabled: true,
        patternReplication: {
            windowSize: 10,                // Kích thước cửa sổ phát hiện
            minMatchRequired: 3,           // Số trùng khớp tối thiểu
            baseConfidence: 0.75,          // Độ tin cậy cơ sở
            confidencePerMatch: 0.05       // Tăng độ tin cậy theo số trùng khớp
        },
        // Mới: Phát hiện sự kiện không điển hình
        anomalyDetection: {
            enabled: true,
            windowSize: 20,                // Kích thước cửa sổ phát hiện
            thresholdDeviation: 2.0,       // Ngưỡng độ lệch chuẩn
            minConfidence: 0.7             // Độ tin cậy tối thiểu
        }
    }
};

// Export cấu hình ra ngoài
module.exports = CONFIG; 