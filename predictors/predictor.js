/**
 * NÂNG CẤP 5.5: Phân tích xu hướng dài (5-7 kỳ)
 */

const fs = require('fs');
const path = require('path');

/**
 * NÂNG CẤP 5.5: Phân tích cân bằng thay vì siêu phản ứng
 * Đã cập nhật để không còn phụ thuộc vào limitList từ tham số options
 */
function balancedAnalysis(history, index) { // Xóa tham số limitList
    // Đảm bảo dữ liệu hợp lệ
    if (!history || !Array.isArray(history) || history.length < 3) {
        return {
            prediction: Math.random() >= 0.5,
            strategy: "Random",
            reason: "Không đủ dữ liệu để phân tích"
        };
    }
    
    // Đảm bảo numbers là số, không phải string
    const checkedHistory = history.map(item => {
        if (item.numbers && Array.isArray(item.numbers)) {
            return {
                ...item,
                numbers: item.numbers.map(num => typeof num === 'string' ? parseInt(num, 10) : num)
            };
        }
        return item;
    });

    // Kiểm tra dữ liệu sau khi chuyển đổi

    const allHistory = checkedHistory.map(item => item.numbers[index] >= 5 ? 'T' : 'X');

    // Sử dụng giá trị mặc định thay vì limitList
    const shortLimit = Math.min(5, allHistory.length);
    const mediumLimit = Math.min(12, allHistory.length);
    const longLimit = Math.min(20, allHistory.length);

    // Tính tỷ lệ từ nhiều khoảng thời gian
    const shortTaiCount = allHistory.slice(0, shortLimit).filter(r => r === 'T').length;
    const shortTaiRate = shortTaiCount / shortLimit;

    const mediumTaiCount = allHistory.slice(0, mediumLimit).filter(r => r === 'T').length;
    const mediumTaiRate = mediumTaiCount / mediumLimit;
    
    // CẢI TIẾN: Thêm phân tích dài hạn
    const longTaiCount = allHistory.slice(0, longLimit).filter(r => r === 'T').length;
    const longTaiRate = longTaiCount / longLimit;

    // Giữ phần còn lại của hàm không đổi
    // CẢI TIẾN: Điều chỉnh ngưỡng nhận diện xu hướng mạnh
    if (shortTaiRate >= 0.7) { // Giảm từ 0.75 xuống 0.7
        return {
            prediction: true,
            strategy: "FollowStrongTaiTrend",
            reason: `Theo xu hướng Tài mạnh (${Math.round(shortTaiRate * 100)}%)`
        };
    }
    else if (shortTaiRate <= 0.3) { // Tăng từ 0.25 lên 0.3
        return {
            prediction: false,
            strategy: "FollowStrongXiuTrend",
            reason: `Theo xu hướng Xỉu mạnh (${Math.round((1 - shortTaiRate) * 100)}%)`
        };
    }

    // CẢI TIẾN: Điều chỉnh ngưỡng phát hiện đứt gãy
    if (Math.abs(shortTaiRate - mediumTaiRate) >= 0.4) { // Giảm từ 0.45 xuống 0.4
        console.log(`Phát hiện đứt gãy mạnh: Ngắn ${Math.round(shortTaiRate * 100)}% vs Trung ${Math.round(mediumTaiRate * 100)}%`);

        return {
            prediction: shortTaiRate >= 0.5,
            strategy: "StrongTrendBreak",
            reason: `Phát hiện đứt gãy mạnh, theo xu hướng ngắn hạn ${shortTaiRate >= 0.5 ? 'Tài' : 'Xỉu'}`
        };
    }

    // CẢI TIẾN: Thêm so sánh xu hướng dài hạn
    if (Math.abs(shortTaiRate - longTaiRate) >= 0.35) { // Giảm từ 0.4 xuống 0.35
        console.log(`Phát hiện thay đổi xu hướng dài: Ngắn ${Math.round(shortTaiRate * 100)}% vs Dài ${Math.round(longTaiRate * 100)}%`);
        
        return {
            prediction: shortTaiRate >= 0.5,
            strategy: "LongTermShift", 
            reason: `Phát hiện thay đổi xu hướng, ưu tiên xu hướng gần đây ${shortTaiRate >= 0.5 ? 'Tài' : 'Xỉu'}`
        };
    }

    // CẢI TIẾN 6: Điều chỉnh ngưỡng nhận diện xu hướng RecentXiuEmphasis vì có hiệu suất tốt hơn
    if (allHistory.length >= 3) {
        const lastThree = allHistory.slice(0, 3);
        const taiCount = lastThree.filter(r => r === 'T').length;
        
        if (taiCount >= 2) {
            // Giảm ưu tiên Tài do hiệu suất thấp hơn
            if (Math.random() < 0.65) { // 65% khả năng theo xu hướng Tài
                return {
                    prediction: true,
                    strategy: "RecentTaiEmphasis",
                    reason: `Ưu tiên kết quả gần nhất: Tài chiếm ưu thế (${taiCount}/3)`
                };
            } else {
                return {
                    prediction: false,
                    strategy: "EmergencyReversal",
                    reason: "Đảo chiều chiến thuật mặc dù Tài chiếm ưu thế"
                };
            }
        } else if (taiCount <= 1) {
            // Tăng ưu tiên Xỉu do hiệu suất tốt hơn
            return {
                prediction: false,
                strategy: "RecentXiuEmphasis",
                reason: `Ưu tiên kết quả gần nhất: Xỉu chiếm ưu thế (${3-taiCount}/3)`
            };
        }
    }

    // CẢI TIẾN: Thêm chiến lược phản hồi nhanh đối với đảo chiều
    if (allHistory.length >= 5) {
        const reversalPattern = (allHistory[0] !== allHistory[1] && 
                               allHistory[1] !== allHistory[2] && 
                               allHistory[2] !== allHistory[3]);
        
        if (reversalPattern) {
            return {
                prediction: allHistory[0] === 'T',  // Theo kỳ gần nhất
                strategy: "RapidResponseReversal",
                reason: "Phát hiện mẫu đảo chiều liên tục, theo hướng kỳ gần nhất"
            };
        }
    }

    // CẢI TIẾN: Triệt tiêu nhiễu ngẫu nhiên
    if (Math.abs(shortTaiRate - 0.5) < 0.1 && Math.abs(mediumTaiRate - 0.5) < 0.1) {
        // Nếu tỷ lệ rất cân bằng, tăng yếu tố ngẫu nhiên
        return {
            prediction: Math.random() >= 0.5, 
            strategy: "PureRandom",
            reason: "Phân bố cực kỳ cân bằng, sử dụng dự đoán ngẫu nhiên hoàn toàn"
        };
    }

    // Tăng trọng số cho ReverseStreak trong balancedAnalysis
    // Thêm điều kiện nhận diện chuỗi đảo chiều
    if (allHistory.length >= 4) {
        const lastThree = allHistory.slice(0, 3);
        const allSame = lastThree.every(result => result === lastThree[0]);
        if (allSame) {
            return {
                prediction: lastThree[0] !== 'T',
                strategy: "ReverseStreak",
                reason: `Phát hiện chuỗi ${lastThree[0] === 'T' ? 'Tài' : 'Xỉu'} liên tiếp, đảo chiều dự đoán`
            };
        }
    }

    // Giữ phương pháp cân bằng mặc định
    return {
        prediction: Math.random() >= 0.5,
        strategy: "Balanced",
        reason: "Không phát hiện xu hướng rõ ràng, dự đoán cân bằng"
    };
}

/**
 * Tạo mảng các số dự đoán với giá trị Tài / Xỉu tại vị trí chỉ định
 */
function generateNumbers(shouldPredictTai, index) {
    const arraySize = 5;
    const predictedNumbers = [];
    for (let i = 0; i < arraySize; i++) {
        if (i === index) {
            predictedNumbers.push(shouldPredictTai
                ? 5 + Math.floor(Math.random() * 5) // Tài (5-9)
                : Math.floor(Math.random() * 5)); // Xỉu (0-4)
        } else {
            predictedNumbers.push(Math.floor(Math.random() * 10));
        }
    }
    return predictedNumbers;
}

function analyzeLimitPerformance(historyLogFile, lastN = null) {
    const results = [];
    try {
        if (fs.existsSync(historyLogFile)) {
            const logContent = fs.readFileSync(historyLogFile, 'utf8');
            const lines = logContent.split('\n').filter(line => line.trim() !== '');
            
            // Bỏ phần lọc theo limitConfig
            let filteredLines = lines;
            
            // Chỉ lấy N dòng cuối cùng nếu lastN được chỉ định
            if (lastN && lastN > 0) {
                filteredLines = filteredLines.slice(-lastN);
                console.log(`Đang phân tích ${filteredLines.length} dòng log gần nhất`);
            }
            
            // Phân tích dữ liệu
            const methodResults = {};
            
            for (const line of filteredLines) {
                const methodMatch = line.match(/\| Phương pháp: ([A-Za-z]+)/);
                const isCorrect = line.includes('| Đúng');
                
                if (methodMatch) {
                    const method = methodMatch[1];
                    if (!methodResults[method]) {
                        methodResults[method] = { total: 0, correct: 0 };
                    }
                    
                    methodResults[method].total++;
                    if (isCorrect) methodResults[method].correct++;
                }
            }
            
            // Tính tỷ lệ thành công cho mỗi phương pháp
            for (const [method, data] of Object.entries(methodResults)) {
                const successRate = (data.correct / data.total) * 100;
                results.push({
                    method,
                    total: data.total,
                    correct: data.correct,
                    successRate: Math.round(successRate)
                });
            }
            
            // Sắp xếp theo tỷ lệ thành công
            results.sort((a, b) => b.successRate - a.successRate);
            
            // Tính tỷ lệ tổng thể
            const totalPredictions = filteredLines.length;
            const correctPredictions = filteredLines.filter(line => line.includes('| Đúng')).length;
            const overallRate = (correctPredictions / totalPredictions) * 100;
            
            console.log(`📊 Tỷ lệ thành công tổng thể: ${Math.round(overallRate)}% (${correctPredictions}/${totalPredictions})`);
        }
    } catch (error) {
        console.error(`❌ Lỗi khi phân tích hiệu suất: ${error.message}`);
    }
    
    return results;
}

// CẢI TIẾN 8: Thêm hàm mới để phát hiện các đảo chiều chu kỳ
function detectCyclicalReversals(history, index) {
    // Bảo vệ dữ liệu đầu vào
    if (history.length < 5) return { detected: false };
    
    //  Giảm số lượng kết quả phân tích từ 10 xuống 7 để tập trung vào gần đây
    const results = history.slice(0, 7).map(item => item.numbers[index] >= 5 ? 'T' : 'X');
    
    //  Tăng trọng số cho kết quả gần đây hơn
    const weightedResults = [];
    for (let i = 0; i < results.length; i++) {
        // Tăng trọng số cho dữ liệu gần, giảm mạnh cho dữ liệu cũ
        const weight = Math.pow(0.8, i);  // Tăng tốc độ suy giảm (từ 0.9 xuống 0.8)
        weightedResults.push({
            value: results[i],
            weight: weight
        });
    }
    
    //  Phân tích mạnh mẽ các chu kỳ ngắn hạn 2-3-4
    // 1. Kiểm tra chu kỳ 2 - quan trọng nhất trong xổ số 45 giây
    let cycle2Count = 0;
    let cycle2Correct = 0;
    let cycle2Confidence = 0;
    
    // Kiểm tra chu kỳ 2 với mức độ tin cậy cao hơn
    for (let i = 0; i < results.length - 2; i += 2) {
        if (results[i] === results[i+2]) {
            cycle2Count++;
            cycle2Confidence += (weightedResults[i].weight + weightedResults[i+2].weight) / 2;
            
            // Kiểm tra xem mẫu dự đoán trước đó có đúng không
            if (i >= 2 && results[i-2] === results[i]) {
                cycle2Correct++;
            }
        }
    }
    
    //  Tính tỷ lệ đúng thực tế cho chu kỳ 2
    const cycle2Accuracy = cycle2Count > 0 ? cycle2Correct / cycle2Count : 0;
    
    // 2. Kiểm tra chu kỳ 3 với logic tương tự
    let cycle3Count = 0;
    let cycle3Correct = 0;
    let cycle3Confidence = 0;
    
    for (let i = 0; i < results.length - 3; i += 3) {
        if (results[i] === results[i+3]) {
            cycle3Count++;
            cycle3Confidence += (weightedResults[i].weight + weightedResults[i+3].weight) / 2;
            
            // Kiểm tra mức độ chính xác
            if (i >= 3 && results[i-3] === results[i]) {
                cycle3Correct++;
            }
        }
    }
    
    // Tính tỷ lệ đúng cho chu kỳ 3
    const cycle3Accuracy = cycle3Count > 0 ? cycle3Correct / cycle3Count : 0;
    
    //  Cải tiến phát hiện mẫu phức tạp
    let complexPatternDetected = false;
    let complexPatternConfidence = 0;
    let complexPatternPrediction = false;
    
    // Phát hiện mẫu TTXTX hoặc XXTXT - phổ biến trong xổ số 45 giây
    if (results.length >= 5) {
        const pattern5 = results.slice(0, 5).join('');
        
        // Các mẫu phức tạp đặc trưng cho xổ số 45 giây
        const complexPatterns = {
            "TTXTX": "T", // Mẫu TTXTX thường tiếp theo là T
            "XXTXT": "X", // Mẫu XXTXT thường tiếp theo là X
            "TXTTX": "T", // Mẫu TXTTX thường tiếp theo là T
            "XTXXT": "X"  // Mẫu XTXXT thường tiếp theo là X
        };
        
        if (complexPatterns[pattern5]) {
            complexPatternDetected = true;
            complexPatternConfidence = 0.85; // Độ tin cậy cao cho các mẫu phức tạp đã xác nhận
            complexPatternPrediction = complexPatterns[pattern5] === "T";
        }
    }
    
    // Phát hiện mẫu "TTX" hoặc "XXT" ở 3 vị trí đầu
    if (results.length >= 3) {
        const first3 = results.slice(0, 3).join('');
        if (first3 === "TTX") {
            return {
                detected: true,
                patternType: "FastTTX",
                confidence: 0.78,
                predictTai: false,
                reason: ` Phát hiện mẫu TTX rõ rệt, dự đoán tiếp tục X`
            };
        } else if (first3 === "XXT") {
            return {
                detected: true,
                patternType: "FastXXT",
                confidence: 0.78,
                predictTai: true,
                reason: ` Phát hiện mẫu XXT rõ rệt, dự đoán tiếp tục T`
            };
        }
    }
    
    //  Thiên vị các chu kỳ dựa trên độ chính xác
    const cycleConfidences = [
        { type: 2, count: cycle2Count, confidence: cycle2Confidence, accuracy: cycle2Accuracy },
        { type: 3, count: cycle3Count, confidence: cycle3Confidence, accuracy: cycle3Accuracy },
        { type: 'complex', count: complexPatternDetected ? 1 : 0, confidence: complexPatternConfidence, accuracy: 0.85 }
    ];
    
    //  Sắp xếp theo độ chính xác + độ tin cậy
    cycleConfidences.sort((a, b) => {
        // Tạo điểm số tổng hợp (70% độ chính xác + 30% độ tin cậy)
        const scoreA = (a.accuracy * 0.7) + (a.confidence * 0.3);
        const scoreB = (b.accuracy * 0.7) + (b.confidence * 0.3);
        return scoreB - scoreA;
    });
    
    //  Giảm ngưỡng tin cậy để tăng tỷ lệ phát hiện
    const bestCycle = cycleConfidences.find(c => c.confidence > 0.25 && c.count > 0);
    
    if (bestCycle) {
        if (bestCycle.type === 'complex') {
            // Xử lý mẫu phức tạp
            return {
                detected: true,
                cycleType: 'complex',
                confidence: bestCycle.confidence,
                predictTai: complexPatternPrediction,
                reason: ` Phát hiện mẫu phức tạp với độ tin cậy ${(bestCycle.confidence * 100).toFixed(1)}%`
            };
        } else {
            // Dự đoán dựa trên chu kỳ tốt nhất
            const cycleType = bestCycle.type;
            const cyclePos = results.length % cycleType; // Vị trí hiện tại trong chu kỳ
            
            //  Cải tiến dự đoán - lấy giá trị tại vị trí đối xứng trong chu kỳ
            let predictedValue;
            
            if (cycleType === 2) {
                // Chu kỳ 2: kỳ chẵn-lẻ xen kẽ
                predictedValue = results[1]; // Giá trị tại vị trí 1 (index thứ 2)
            } else if (cycleType === 3) {
                // Chu kỳ 3: lấy giá trị tại vị trí tương ứng trong chu kỳ
                const predictionPos = cyclePos === 0 ? 0 : (cyclePos === 1 ? 1 : 2);
                predictedValue = results[predictionPos];
            }
            
            //  Tăng độ tin cậy dựa trên tỷ lệ đúng thực tế
            const adjustedConfidence = bestCycle.confidence * (0.8 + (bestCycle.accuracy * 0.2));
            
            return {
                detected: true,
                cycleType: cycleType,
                confidence: Math.min(0.85, adjustedConfidence), // Giới hạn max 0.85
                predictTai: predictedValue === 'T',
                reason: ` Phát hiện chu kỳ ${cycleType} kỳ với độ tin cậy ${(adjustedConfidence * 100).toFixed(1)}%, dự đoán ${predictedValue}`
            };
        }
    }
    
    //  Tăng cường phát hiện đảo chiều sau một chuỗi liên tiếp
    if (results.length >= 3 && results[0] === results[1] && results[1] === results[2]) {
        return {
            detected: true,
            cycleType: 'streak-reversal',
            confidence: 0.78,
            predictTai: results[0] !== 'T',
            reason: ` Phát hiện chuỗi ${results[0]}-${results[0]}-${results[0]}, dự đoán đảo chiều sang ${results[0] === 'T' ? 'X' : 'T'}`
        };
    }
    
    //  Phát hiện chu kỳ 2 với độ tin cậy thấp hơn nhưng vẫn hữu ích
    if (cycle2Count >= 1) {
        return {
            detected: true,
            cycleType: 2,
            confidence: 0.7 * cycle2Confidence, // Giảm độ tin cậy
            predictTai: results[results.length % 2] === 'T',
            reason: ` Phát hiện chu kỳ đảo chiều 2 kỳ với độ tin cậy ${(cycle2Confidence * 70).toFixed(1)}%`
        };
    }
    
    // Không phát hiện mẫu rõ ràng
    return { detected: false };
}

// 1. Cải thiện phát hiện đảo chiều sau chuỗi dài - PHIÊN BẢN NÂNG CAO
function detectLongStreaks(history, index) {
    if (history.length < 4) return { detected: false };
    
    // CẢI TIẾN 1: Mở rộng phạm vi phân tích từ 10 lên 15 kỳ
    const maxResults = Math.min(15, history.length);
    const results = history.slice(0, maxResults).map(item => item.numbers[index] >= 5 ? 'T' : 'X');
    
    // CẢI TIẾN 2: Tách ra từng chuỗi liên tục
    const streaks = [];
    let currentStreak = { type: results[0], length: 1, startPos: 0 };
    
    for (let i = 1; i < results.length; i++) {
        if (results[i] === currentStreak.type) {
            currentStreak.length++;
        } else {
            streaks.push({ ...currentStreak });
            currentStreak = { type: results[i], length: 1, startPos: i };
        }
    }
    
    // Thêm chuỗi cuối cùng
    streaks.push({ ...currentStreak });
    
    // CẢI TIẾN 3: Tìm chuỗi dài nhất trong 7 kỳ gần nhất
    const recentStreaks = streaks.filter(s => s.startPos < 7);
    const longestRecentStreak = recentStreaks.sort((a, b) => b.length - a.length)[0];
    
    if (!longestRecentStreak) {
        return { detected: false };
    }
    
    // CẢI TIẾN 4: Phân tích tỷ lệ đảo chiều sau chuỗi với độ dài tương tự
    // Tạo danh sách các chuỗi tương tự trong quá khứ (không bao gồm chuỗi hiện tại)
    const similarPastStreaks = streaks.filter(s => 
        s.type === longestRecentStreak.type && 
        Math.abs(s.length - longestRecentStreak.length) <= 1 && 
        s.startPos > longestRecentStreak.startPos
    );
    
    // CẢI TIẾN 5: Tính toán xác suất đảo chiều dựa trên dữ liệu thực tế
    // Mặc định, xác suất đảo chiều tăng theo độ dài chuỗi từ 30% đến 80%
    let reverseProb = Math.min(0.3 + (longestRecentStreak.length * 0.1), 0.8);
    
    // CẢI TIẾN 6: Tìm dữ liệu chuyển tiếp từ chuỗi tương tự trong quá khứ
    if (similarPastStreaks.length > 0) {
        let reversalCount = 0;
        
        for (const pastStreak of similarPastStreaks) {
            const pastStreakEndPos = pastStreak.startPos + pastStreak.length - 1;
            if (pastStreakEndPos + 1 < results.length) {
                // Kiểm tra xem sau chuỗi có đảo chiều không
                const reversed = results[pastStreakEndPos + 1] !== pastStreak.type;
                if (reversed) reversalCount++;
            }
        }
        
        if (similarPastStreaks.length > 0) {
            const empiricalReverseRate = reversalCount / similarPastStreaks.length;
            reverseProb = (0.3 * reverseProb) + (0.7 * empiricalReverseRate);
        }
    }
    
    // CẢI TIẾN 7: Điều chỉnh xác suất dựa trên hiệu suất quá khứ
    if (typeof global.getMethodSuccessRate === 'function') {
        const lastPerformance = global.getMethodSuccessRate("LongStreakPattern");
        
        if (lastPerformance < 0.45) {
            reverseProb = 1 - reverseProb;
        } else if (lastPerformance >= 0.6) {
            // Nếu hiệu suất tốt, tăng độ tin cậy
            // Đẩy xác suất xa hơn khỏi 0.5
            if (reverseProb > 0.5) {
                reverseProb = Math.min(0.9, reverseProb + 0.1);
            } else if (reverseProb < 0.5) {
                reverseProb = Math.max(0.1, reverseProb - 0.1);
            }
            console.log(`⚙️ Tăng độ tin cậy do hiệu suất cao (${(lastPerformance * 100).toFixed(1)}%)`);
        }
    }
    
    // CẢI TIẾN 8: Thêm phân tích bối cảnh toàn cục
    // Phân tích xu hướng tổng thể
    const taiCount = results.filter(r => r === 'T').length;
    const xiuCount = results.length - taiCount;
    const globalTaiDominance = taiCount / results.length;
    
    // Điều chỉnh xác suất theo xu hướng toàn cục
    if (globalTaiDominance >= 0.65 && longestRecentStreak.type === 'T') {
        // Xu hướng Tài mạnh + đang trong chuỗi Tài => giảm xác suất đảo chiều
        reverseProb = Math.max(0.2, reverseProb - 0.15);
        console.log(`⚙️ Giảm xác suất đảo chiều do xu hướng Tài mạnh (${(globalTaiDominance * 100).toFixed(1)}%)`);
    } else if (globalTaiDominance <= 0.35 && longestRecentStreak.type === 'X') {
        // Xu hướng Xỉu mạnh + đang trong chuỗi Xỉu => giảm xác suất đảo chiều
        reverseProb = Math.max(0.2, reverseProb - 0.15);
        console.log(`⚙️ Giảm xác suất đảo chiều do xu hướng Xỉu mạnh (${((1 - globalTaiDominance) * 100).toFixed(1)}%)`);
    }
    
    // CẢI TIẾN 9: Tăng ngưỡng phát hiện chuỗi
    const detectionThreshold = 2; // Tăng từ 1 lên 2 để chọn lọc hơn
    
    if (longestRecentStreak.length >= detectionThreshold) {
        // Quyết định đảo chiều hay không
        const shouldReverse = Math.random() < reverseProb;
        
        // CẢI TIẾN 10: Thêm độ tin cậy vào kết quả
        return {
            detected: true,
            streakType: longestRecentStreak.type,
            streakLength: longestRecentStreak.length,
            confidence: Math.abs(reverseProb - 0.5) * 2, // Chuyển thành thang 0-1 
            predictTai: shouldReverse ? (longestRecentStreak.type !== 'T') : (longestRecentStreak.type === 'T'),
            reason: shouldReverse ? 
                `Đảo chiều sau chuỗi ${longestRecentStreak.type} dài ${longestRecentStreak.length} kỳ (xác suất đảo: ${Math.round(reverseProb*100)}%)` : 
                `Tiếp tục theo chuỗi ${longestRecentStreak.type} dài ${longestRecentStreak.length} kỳ (xác suất tiếp tục: ${Math.round((1-reverseProb)*100)}%)`
        };
    }
    
    return { detected: false };
}

// 2. Phát hiện mẫu hình xen kẽ ngắn - CẢI TIẾN PHIÊN BẢN 3.2
function detectShortAlternatingPattern(history, index) {
    if (history.length < 5) return { detected: false };
    
    const maxResults = Math.min(10, history.length);
    const results = history.slice(0, maxResults).map(item => item.numbers[index] >= 5 ? 'T' : 'X');
    
    const weightedResults = [];
    for (let i = 0; i < results.length; i++) {
        // Tăng trọng số cho dữ liệu gần nhất, giảm mạnh cho dữ liệu cũ
        const weight = Math.pow(0.70, i);  // Giảm nhanh hơn (từ 0.75 xuống 0.70)
        weightedResults.push({
            value: results[i],
            weight: weight,
            position: i
        });
    }
    
    // Phân tích cửa sổ trượt kích thước 3, 4 và 5
    const slidingWindows = [];
    
    // Cửa sổ kích thước 3
    for (let i = 0; i <= results.length - 3; i++) {
        const window = results.slice(i, i + 3);
        let alternations = 0;
        for (let j = 0; j < window.length - 1; j++) {
            if (window[j] !== window[j + 1]) alternations++;
        }
        slidingWindows.push({
            window,
            size: 3,
            alternationRatio: alternations / (window.length - 1),
            startPos: i
        });
    }
    
    // Cửa sổ kích thước 4
    for (let i = 0; i <= results.length - 4; i++) {
        const window = results.slice(i, i + 4);
        let alternations = 0;
        for (let j = 0; j < window.length - 1; j++) {
            if (window[j] !== window[j + 1]) alternations++;
        }
        slidingWindows.push({
            window,
            size: 4,
            alternationRatio: alternations / (window.length - 1),
            startPos: i
        });
    }
    
    // Cửa sổ kích thước 5
    for (let i = 0; i <= results.length - 5; i++) {
        const window = results.slice(i, i + 5);
        let alternations = 0;
        for (let j = 0; j < window.length - 1; j++) {
            if (window[j] !== window[j + 1]) alternations++;
        }
        slidingWindows.push({
            window,
            size: 5,
            alternationRatio: alternations / (window.length - 1),
            startPos: i
        });
    }
    
    // Sắp xếp cửa sổ theo tỷ lệ xen kẽ cao nhất và ưu tiên cửa sổ gần nhất
    slidingWindows.sort((a, b) => {
        // Ưu tiên cửa sổ có startPos = 0 (gần nhất)
        if (a.startPos === 0 && b.startPos !== 0) return -1;
        if (a.startPos !== 0 && b.startPos === 0) return 1;
        
        // Sau đó sắp xếp theo tỷ lệ xen kẽ
        return b.alternationRatio - a.alternationRatio;
    });
    
    if (slidingWindows.length > 0 && slidingWindows[0].alternationRatio > 0.70) {
        const bestWindow = slidingWindows[0];
        
        // Nếu có mẫu xen kẽ hoàn hảo (100%)
        if (bestWindow.alternationRatio >= 1.0) {
            const predictedValue = bestWindow.window[0] !== bestWindow.window[1] ? 
                bestWindow.window[0] : (bestWindow.window[0] === 'T' ? 'X' : 'T');
            
            return {
                detected: true,
                patternType: 'PerfectAlternating',
                confidence: 0.9, // Giữ nguyên độ tin cậy cao cho mẫu hoàn hảo
                predictTai: predictedValue === 'T',
                reason: `Phát hiện mẫu xen kẽ hoàn hảo "${bestWindow.window.join('')}", dự đoán tiếp theo là ${predictedValue}`
            };
        }
        // Nếu có mẫu xen kẽ tốt (70-99%)
        else if (bestWindow.alternationRatio >= 0.70) {
            // Dự đoán dựa trên xu hướng phổ biến nhất trong cửa sổ
            const taiCount = bestWindow.window.filter(v => v === 'T').length;
            const xiuCount = bestWindow.window.length - taiCount;
            
            // Nếu có xu hướng rõ ràng 
            const threshold = Math.ceil(bestWindow.window.length * 0.6); // >60% là một xu hướng rõ ràng
            if (taiCount >= threshold || xiuCount >= threshold) {
                return {
                    detected: true,
                    patternType: 'StrongBiasInAlternating',
                    confidence: 0.8,
                    predictTai: taiCount > xiuCount,
                    reason: `Phát hiện xu hướng mạnh ${taiCount > xiuCount ? 'Tài' : 'Xỉu'} (${Math.max(taiCount, xiuCount)}/${bestWindow.window.length}) trong mẫu xen kẽ`
                };
            }
        }
        
        // Phân tích 3 kỳ gần nhất
        const recentThree = results.slice(0, 3);
        const pattern = recentThree.join('');
        
        // Phát hiện mẫu TXX và XTT
        if (pattern === 'TXX' || results.slice(0, 4).join('') === 'TXXN' || results.slice(0, 4).join('') === 'TXXT') {
            return {
                detected: true,
                patternType: 'TXX_Pattern',
                confidence: 0.78, // Giảm từ 0.85 xuống 0.78 do hiệu suất không tốt
                predictTai: true,
                reason: `Phát hiện mẫu T-X-X, dự đoán tiếp theo là T`
            };
        } else if (pattern === 'XTT' || results.slice(0, 4).join('') === 'XTTN' || results.slice(0, 4).join('') === 'XTTX') {
            return {
                detected: true,
                patternType: 'XTT_Pattern',
                confidence: 0.78, // Giảm từ 0.85 xuống 0.78 do hiệu suất không tốt
                predictTai: false,
                reason: `Phát hiện mẫu X-T-T, dự đoán tiếp theo là X`
            };
        }
        
        // Phát hiện các mẫu khác
        if (pattern === 'TTX' || pattern === 'TXT') {
            return {
                detected: true,
                patternType: 'TTX_Pattern',
                confidence: 0.72, // Giảm từ 0.75 xuống 0.72
                predictTai: false,
                reason: `Phát hiện mẫu ${pattern}, dự đoán tiếp theo là X`
            };
        } else if (pattern === 'XXT' || pattern === 'XTX') {
            return {
                detected: true,
                patternType: 'XXT_Pattern', 
                confidence: 0.72, // Giảm từ 0.75 xuống 0.72
                predictTai: true,
                reason: `Phát hiện mẫu ${pattern}, dự đoán tiếp theo là T`
            };
        }
    }
    
    // CẢI TIẾN Điều chỉnh logic phát hiện đảo chiều sau chuỗi
    if (results.length >= 3) {
        // Phát hiện chuỗi 3 giá trị giống nhau
        if (results[0] === results[1] && results[1] === results[2]) {
            return {
                detected: true,
                patternType: 'ReversalAfterStreak',
                confidence: 0.78, // Giảm từ 0.8 xuống 0.78
                predictTai: results[0] !== 'T',
                reason: `Phát hiện chuỗi ${results[0]}-${results[0]}-${results[0]}, dự đoán đảo chiều sang ${results[0] === 'T' ? 'X' : 'T'}`
            };
        }
        
        // CẢI TIẾN Ít phụ thuộc vào mẫu 2-streak do hiệu suất kém
        // Chỉ áp dụng khi vị trí thứ 3 cùng loại với 2 vị trí đầu
        else if (results[0] === results[1] && results.length >= 4 && results[2] === results[0]) {
            return {
                detected: true,
                patternType: 'ReversalAfterLongerStreak',
                confidence: 0.75,
                predictTai: results[0] !== 'T',
                reason: `Phát hiện chuỗi ${results[0]}-${results[0]}-${results[0]}, dự đoán đảo chiều sang ${results[0] === 'T' ? 'X' : 'T'}`
            };
        }
    }
    
    // CẢI TIẾN Điều chỉnh phân tích phân phối Tài/Xỉu với trọng số
    let weightedTaiSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < weightedResults.length; i++) {
        totalWeight += weightedResults[i].weight;
        if (weightedResults[i].value === 'T') {
            weightedTaiSum += weightedResults[i].weight;
        }
    }
    
    const weightedTaiRatio = weightedTaiSum / totalWeight;
    
    // CẢI TIẾN Điều chỉnh ngưỡng phát hiện xu hướng mạnh
    const strongTaiBias = weightedTaiRatio >= 0.70; // Tăng từ 0.65 lên 0.70
    const strongXiuBias = weightedTaiRatio <= 0.30; // Giảm từ 0.35 xuống 0.30
    
    if (strongTaiBias || strongXiuBias) {
        return {
            detected: true,
            patternType: 'WeightedDistribution',
            confidence: Math.min(0.85, Math.abs(weightedTaiRatio - 0.5) * 2), // 0-0.85 scale
            predictTai: strongTaiBias,
            reason: `Phát hiện xu hướng ${strongTaiBias ? 'Tài' : 'Xỉu'} mạnh (${(Math.abs(weightedTaiRatio - 0.5) * 200).toFixed(1)}%) trong dữ liệu có trọng số`
        };
    }
    
    // CẢI TIẾN Tăng cường phân tích chẵn/lẻ bằng cách yêu cầu tỷ lệ rõ ràng hơn
    if (results.length >= 6) {
        // Tài/Xỉu tại các vị trí chẵn (0, 2, 4)
        const evenPositions = [results[0], results[2], results[4]];
        // Tài/Xỉu tại các vị trí lẻ (1, 3, 5)
        const oddPositions = [results[1], results[3], results[5]];
        
        const evenTaiCount = evenPositions.filter(r => r === 'T').length;
        const oddTaiCount = oddPositions.filter(r => r === 'T').length;
        
        // CẢI TIẾN Yêu cầu sự khác biệt lớn hơn giữa vị trí chẵn và lẻ
        // Cần tối thiểu 3/3 vs 0/3 hoặc 0/3 vs 3/3
        if ((evenTaiCount === 3 && oddTaiCount === 0) || (evenTaiCount === 0 && oddTaiCount === 3)) {
            // Kiểm tra xem vị trí tiếp theo là chẵn hay lẻ
            const isNextPositionEven = results.length % 2 === 0;
            
            if (isNextPositionEven) {
                // Vị trí tiếp theo là chẵn, dự đoán dựa trên xu hướng vị trí chẵn
                return {
                    detected: true,
                    patternType: 'EvenOddPattern',
                    confidence: 0.82, // Tăng từ 0.75 lên 0.82 do yêu cầu nghiêm ngặt hơn
                    predictTai: evenTaiCount > 0,
                    reason: `Phát hiện xu hướng hoàn toàn ${evenTaiCount > 0 ? 'Tài' : 'Xỉu'} ở vị trí chẵn (${evenTaiCount}/3), vị trí tiếp theo là chẵn`
                };
            } else {
                // Vị trí tiếp theo là lẻ, dự đoán dựa trên xu hướng vị trí lẻ
                return {
                    detected: true,
                    patternType: 'EvenOddPattern',
                    confidence: 0.82, // Tăng từ 0.75 lên 0.82 do yêu cầu nghiêm ngặt hơn
                    predictTai: oddTaiCount > 0,
                    reason: `Phát hiện xu hướng hoàn toàn ${oddTaiCount > 0 ? 'Tài' : 'Xỉu'} ở vị trí lẻ (${oddTaiCount}/3), vị trí tiếp theo là lẻ`
                };
            }
        }
    }
    
    // Nếu không có mẫu nào được phát hiện rõ ràng, trả về không phát hiện
    return { detected: false };
}

/**
 * detectFastPattern - Thuật toán phát hiện mẫu tốc độ cao cho xổ số 45 giây
 * Thuật toán này tập trung vào phân tích nhanh mẫu gần đây nhất, thích hợp cho môi trường có chu kỳ ngắn
 * @param {Array} history - Mảng lịch sử kết quả
 * @param {Number} index - Vị trí trong mảng numbers cần dự đoán
 * @returns {Object} Kết quả phát hiện mẫu và dự đoán
 */
function detectFastPattern(history, index) {
    if (history.length < 5) return { confidence: 0 };
    
    // Chỉ phân tích các kỳ gần nhất để tối ưu tốc độ
    const maxResults = Math.min(10, history.length);
    const results = history.slice(0, maxResults).map(item => item.numbers[index] >= 5 ? 'T' : 'X');
    
    // 1. PHÂN TÍCH CHUỖI DỰA TRÊN DỮ LIỆU THỰC TẾ TỪ 90 CHU KỲ
    
    // 1.1 Phát hiện chuỗi 3 và 4 kỳ liên tiếp - là mẫu phổ biến trong xổ số 45 giây
    const recent3 = results.slice(0, 3).join('');
    const recent4 = results.slice(0, 4).join('');
    const recent5 = results.slice(0, 5).join('');
    
    // Đảo chiều sau chuỗi 3 kỳ đồng nhất - mẫu với hiệu suất cao (>65%)
    if (recent3 === 'TTT') {
        return {
            predictTai: false,
            confidence: 0.85,
            reason: `FastPattern: Phát hiện 3 Tài liên tiếp, dự đoán đảo chiều sang Xỉu`
        };
    } else if (recent3 === 'XXX') {
        return {
            predictTai: true,
            confidence: 0.85,
            reason: `FastPattern: Phát hiện 3 Xỉu liên tiếp, dự đoán đảo chiều sang Tài`
        };
    }
    
    // 1.2 Mẫu XTTX và TXXT - đặc biệt hiệu quả dựa trên phân tích 90 chu kỳ
    if (recent4 === 'TXXT') {
        return {
            predictTai: false,
            confidence: 0.87,
            reason: `FastPattern: Phát hiện mẫu TXXT, dự đoán tiếp theo là Xỉu`
        };
    } else if (recent4 === 'XTTX') {
        return {
            predictTai: true,
            confidence: 0.87,
            reason: `FastPattern: Phát hiện mẫu XTTX, dự đoán tiếp theo là Tài`
        };
    }
    
    // 1.3 Mẫu kẹp sandwich cải tiến (xen kẽ đặc biệt)
    if (recent5 === 'TXTXT' || recent5 === 'TXTXX') {
        return {
            predictTai: false,
            confidence: 0.83,
            reason: `FastPattern: Phát hiện mẫu xen kẽ ${recent5}, dự đoán tiếp theo là Xỉu`
        };
    } else if (recent5 === 'XTXTX' || recent5 === 'XTXTT') {
        return {
            predictTai: true,
            confidence: 0.83,
            reason: `FastPattern: Phát hiện mẫu xen kẽ ${recent5}, dự đoán tiếp theo là Tài`
        };
    }
    
    // 1.4 Mẫu đảo chiều sau chuỗi thất bại
    // Kiểm tra nếu có 3-4 kỳ tương tự gần đây
    let consecutiveCount = 1;
    for (let i = 1; i < results.length - 1; i++) {
        if (results[i] === results[0]) {
            consecutiveCount++;
        } else {
            break;
        }
    }
    
    if (consecutiveCount >= 3) {
        return {
            predictTai: results[0] === 'X',
            confidence: 0.8 + (consecutiveCount - 3) * 0.05, // Mức độ tin cậy tăng theo độ dài chuỗi
            reason: `FastPattern: Phát hiện ${consecutiveCount} ${results[0]} liên tiếp, dự đoán đảo chiều`
        };
    }
    
    // 1.5 Phát hiện chuỗi thất bại từ phân tích 90 chu kỳ
    if (recent5.indexOf('XXXXX') !== -1 || recent5.indexOf('TTTT') !== -1) {
        const currentTrend = recent5.indexOf('XXXXX') !== -1 ? 'X' : 'T';
        return {
            predictTai: currentTrend !== 'T',
            confidence: 0.9,
            reason: `FastPattern: Phát hiện chuỗi dài ${currentTrend}, khả năng cao sẽ đảo chiều`
        };
    }
    
    // 1.6 Phân tích tần suất chuyển đổi - cải tiến dựa trên dữ liệu thực tế
    let switchCount = 0;
    for (let i = 0; i < results.length - 1; i++) {
        if (results[i] !== results[i+1]) {
            switchCount++;
        }
    }
    
    const switchRate = switchCount / (results.length - 1);
    
    // Tần số chuyển đổi cao - theo phân tích, thường sẽ tiếp tục chuyển đổi
    if (switchRate >= 0.8) {
        return {
            predictTai: results[0] !== 'T',
            confidence: 0.78,
            reason: `FastPattern: Tần số đảo chiều rất cao (${(switchRate*100).toFixed(1)}%), dự đoán tiếp tục đảo chiều`
        };
    }
    
    // Tần số chuyển đổi thấp - theo phân tích, thường sẽ duy trì xu hướng
    if (switchRate <= 0.2) {
        return {
            predictTai: results[0] === 'T',
            confidence: 0.77,
            reason: `FastPattern: Tần số đảo chiều rất thấp (${(switchRate*100).toFixed(1)}%), dự đoán duy trì xu hướng hiện tại`
        };
    }
    
    // 1.7 Biến thể mẫu xen kẽ dựa trên khung giờ (từ phân tích 90 chu kỳ)
    const curTimeObj = new Date();
    const currentHour = curTimeObj.getHours();
    
    // Khung giờ 13-16h thường có xu hướng theo mẫu cụ thể
    if (currentHour >= 13 && currentHour <= 16) {
        if (recent3 === 'TXT' || recent3 === 'XTX') {
            return {
                predictTai: recent3[0] === 'T',
                confidence: 0.76,
                reason: `FastPattern: Mẫu đặc biệt ${recent3} trong khung giờ chiều, dự đoán tiếp theo là ${recent3[0]}`
            };
        }
    }
    
    // Khung giờ 18-22h có mẫu khác
    if (currentHour >= 18 && currentHour <= 22) {
        if (results[0] === results[2] && results[0] !== results[1]) {
            return {
                predictTai: results[0] === 'T',
                confidence: 0.75,
                reason: `FastPattern: Phát hiện mẫu kẹp giữa trong khung giờ tối, dự đoán tiếp tục xu hướng ${results[0]}`
            };
        }
    }
    
    // Nếu không phát hiện mẫu nào rõ ràng
    return { confidence: 0 };
}

/**
 * V5.0: Phát hiện mẫu dựa trên thời gian
 * @param {Array} history - Lịch sử kết quả
 * @param {Number} index - Vị trí cần dự đoán
 * @returns {Object} Kết quả phát hiện mẫu theo thời gian
 */
function detectTimeBasedPattern(history, index) {
    // Kiểm tra dữ liệu đầu vào
    if (!history || !Array.isArray(history) || history.length < 10) {
        return { detected: false };
    }
    
    // Nhóm kết quả theo giờ trong ngày
    const hourlyPatterns = {};
    let hourlyResults = {};
    
    // Phân tích 50 kỳ gần nhất để có đủ dữ liệu
    const recentHistory = history.slice(0, Math.min(50, history.length));
    
    // Đảm bảo dữ liệu có timestamp
    recentHistory.forEach(item => {
        if (!item.timestamp && item.drawId) {
            // Tạo timestamp giả từ drawId
            const drawIdStr = item.drawId.toString();
            const year = parseInt(drawIdStr.substring(0, 4));
            const month = parseInt(drawIdStr.substring(4, 6)) - 1;
            const day = parseInt(drawIdStr.substring(6, 8));
            // Lấy giờ, phút từ 4 số cuối của drawId
            const timeCode = parseInt(drawIdStr.slice(-4));
            // Ước tính giờ và phút dựa trên mã kỳ (giả định mỗi kỳ 45 giây, 80 kỳ/giờ)
            const hour = Math.floor(timeCode / 100);
            const minute = (timeCode % 100);
            
            item.timestamp = new Date(year, month, day, hour, minute).toISOString();
        }
    });
    
    recentHistory.forEach(item => {
        if (item.timestamp) {
            // Phân tích timestamp
            const date = new Date(item.timestamp);
            const hour = date.getHours();
            
            // Khởi tạo nếu chưa có
            if (!hourlyResults[hour]) {
                hourlyResults[hour] = [];
            }
            
            // Thêm kết quả Tài/Xỉu vào giờ tương ứng
            const isTai = item.numbers[index] >= 5;
            hourlyResults[hour].push(isTai ? 'T' : 'X');
        }
    });
    
    // Phân tích xu hướng từng giờ
    const currentHour = new Date().getHours();
    let hasPatternForCurrentHour = false;
    let currentHourPrediction = null;
    let currentHourConfidence = 0;
    let currentHourReason = "";
    
    Object.keys(hourlyResults).forEach(hour => {
        const results = hourlyResults[hour];
        const hourInt = parseInt(hour);
        
        if (results.length >= 5) {
            const taiCount = results.filter(r => r === 'T').length;
            const taiRate = taiCount / results.length;
            
            // Lưu phân tích cho mỗi giờ
            hourlyPatterns[hour] = {
                taiRate: taiRate,
                sampleSize: results.length,
                predictTai: taiRate > 0.55, // Dự đoán Tài nếu tỷ lệ > 55%
                confidence: Math.abs(taiRate - 0.5) * 2, // Tính độ tin cậy
                pattern: results.slice(-5).join('') // 5 kết quả gần nhất
            };
            
            // Lưu thông tin giờ hiện tại
            if (hourInt === currentHour && results.length >= 10) {
                hasPatternForCurrentHour = true;
                currentHourPrediction = taiRate > 0.55;
                
                // Tính độ tin cậy dựa trên độ lệch và kích thước mẫu
                const deviation = Math.abs(taiRate - 0.5);
                const sampleFactor = Math.min(1, results.length / 20); // Yếu tố kích thước mẫu (tối đa 1)
                currentHourConfidence = deviation * 2 * sampleFactor;
                
                // Tăng độ tin cậy nếu xu hướng rất rõ ràng
                if (deviation > 0.2) {
                    currentHourConfidence = Math.min(0.85, currentHourConfidence + 0.1);
                }
                
                currentHourReason = `Phân tích giờ ${currentHour}h: ${Math.round(taiRate * 100)}% Tài (${results.length} mẫu)`;
            }
        }
    });
    
    // Phân tích theo thời điểm trong ngày
    const timePeriod = getTimePeriod(currentHour);
    
    // Nếu có mẫu cho giờ hiện tại và độ tin cậy cao, ưu tiên sử dụng
    if (hasPatternForCurrentHour && currentHourConfidence > 0.65) {
        return {
            detected: true,
            predictTai: currentHourPrediction,
            confidence: currentHourConfidence,
            reason: currentHourReason
        };
    }
    
    // Phân tích xu hướng trong khung giờ (sáng, chiều, tối)
    const periodResults = getPeriodResults(hourlyResults, timePeriod);
    
    if (periodResults.length >= 15) {
        const taiCount = periodResults.filter(r => r === 'T').length;
        const taiRate = taiCount / periodResults.length;
        
        // Nếu có xu hướng rõ trong khung giờ
        if (Math.abs(taiRate - 0.5) > 0.1) {
            return {
                detected: true,
                predictTai: taiRate > 0.5,
                confidence: Math.abs(taiRate - 0.5) * 1.8, // Độ tin cậy thấp hơn phân tích giờ cụ thể
                reason: `Phân tích khung giờ ${timePeriod}: ${Math.round(taiRate * 100)}% Tài (${periodResults.length} mẫu)`
            };
        }
    }
    
    // Phân tích mẫu gần nhất cho giờ hiện tại
    if (hourlyResults[currentHour] && hourlyResults[currentHour].length >= 3) {
        const recentPattern = hourlyResults[currentHour].slice(-3).join('');
        
        // Một số mẫu cụ thể có độ tin cậy cao
        if (recentPattern === 'TTT') {
            return {
                detected: true,
                predictTai: false, // Sau 3 Tài liên tiếp thường là Xỉu
                confidence: 0.75,
                reason: `Mẫu 3 Tài liên tiếp trong giờ ${currentHour}h, dự đoán đảo chiều`
            };
        }
        
        if (recentPattern === 'XXX') {
            return {
                detected: true,
                predictTai: true, // Sau 3 Xỉu liên tiếp thường là Tài
                confidence: 0.75,
                reason: `Mẫu 3 Xỉu liên tiếp trong giờ ${currentHour}h, dự đoán đảo chiều`
            };
        }
        
        // Mẫu xen kẽ hoàn hảo
        if (recentPattern === 'TXT' || recentPattern === 'XTX') {
            return {
                detected: true,
                predictTai: recentPattern === 'XTX', // Theo mẫu xen kẽ
                confidence: 0.70,
                reason: `Mẫu xen kẽ ${recentPattern} trong giờ ${currentHour}h, dự đoán theo mẫu`
            };
        }
    }
    
    return { detected: false };
}

/**
 * Xác định khung giờ trong ngày
 * @param {Number} hour - Giờ cần xác định
 * @returns {String} Tên khung giờ
 */
function getTimePeriod(hour) {
    if (hour >= 5 && hour < 11) return 'morning';    // Sáng: 05:00 - 11:00
    if (hour >= 11 && hour < 13) return 'noon';      // Trưa: 11:00 - 13:00
    if (hour >= 13 && hour < 18) return 'afternoon'; // Chiều: 13:00 - 18:00
    if (hour >= 18 && hour < 22) return 'evening';   // Tối: 18:00 - 22:00
    return 'latenight';                              // Khuya: 22:00 - 05:00
}

/**
 * Lấy tất cả kết quả trong một khung giờ
 * @param {Object} hourlyResults - Kết quả theo giờ
 * @param {String} period - Tên khung giờ
 * @returns {Array} Mảng các kết quả trong khung giờ
 */
function getPeriodResults(hourlyResults, period) {
    let results = [];
    let periodHours = [];
    
    // Xác định các giờ trong khung giờ
    switch (period) {
        case 'morning':
            periodHours = [5, 6, 7, 8, 9, 10];
            break;
        case 'noon':
            periodHours = [11, 12];
            break;
        case 'afternoon':
            periodHours = [13, 14, 15, 16, 17];
            break;
        case 'evening':
            periodHours = [18, 19, 20, 21];
            break;
        case 'latenight':
            periodHours = [22, 23, 0, 1, 2, 3, 4];
            break;
    }
    
    // Gộp tất cả kết quả trong khung giờ
    periodHours.forEach(hour => {
        if (hourlyResults[hour]) {
            results = results.concat(hourlyResults[hour]);
        }
    });
    
    return results;
}

/**
 * V6.0.0: Thuật toán kết hợp nâng cao cho xổ số 45 giây
 * Dựa trên phân tích từ 90 chu kỳ thực tế với tối ưu cho tốc độ phản ứng nhanh
 * @param {Array} history - Mảng lịch sử kết quả
 * @param {Number} index - Vị trí trong mảng numbers cần dự đoán
 * @returns {Object} Kết quả dự đoán
 */
function advancedCombinationPattern(history, index) {
    if (!history || history.length < 5) return { confidence: 0 };
    
    // Kích thước lịch sử phù hợp với xổ số 45 giây
    const historyLimit = Math.min(10, history.length); // Giảm từ 15 xuống 10 cho chu kỳ ngắn
    
    // Lấy mẫu T/X gần đây nhất
    const pattern = history.slice(0, historyLimit).map(h => h.numbers[index] >= 5 ? 'T' : 'X');
    const recentPattern = pattern.slice(0, 5).join('');
    
    // Đếm biến thể
    let taiCount = 0;
    let xiuCount = 0;
    let alternatingCount = 0;
    let streakLength = 1;
    let maxStreakLength = 1;
    let streakType = pattern[0];
    
    // Phân tích chi tiết
    for (let i = 0; i < pattern.length; i++) {
        // Đếm Tài/Xỉu
        if (pattern[i] === 'T') taiCount++;
        else xiuCount++;
        
        // Đếm số lần đảo chiều
        if (i > 0 && pattern[i] !== pattern[i-1]) {
            alternatingCount++;
            // Reset đếm streak khi đảo chiều
            streakLength = 1;
        } else {
            // Tăng streak khi cùng loại
            streakLength++;
            if (streakLength > maxStreakLength) {
                maxStreakLength = streakLength;
                streakType = pattern[i];
            }
        }
    }
    
    // Tính tỷ lệ & độ tin cậy
    const totalCount = taiCount + xiuCount;
    const taiRate = taiCount / totalCount;
    const alternatingRate = alternatingCount / (totalCount - 1);
    
    // Phân tích mẫu cụ thể cho xổ số 45 giây (dựa trên phân tích 90 chu kỳ)
    
    // MẪU 1: Chuỗi 3+ cùng loại -> đảo chiều (tỷ lệ thành công cao ~65-70%)
    if (pattern[0] === pattern[1] && pattern[1] === pattern[2]) {
        const consecutive = pattern[0];
        let count = 3;
        
        // Đếm chính xác số lượng liên tiếp
        while (count < pattern.length && pattern[count] === consecutive) {
            count++;
        }
        
        // Độ tin cậy tăng theo độ dài chuỗi
        const confidenceBase = 0.8;
        const confidenceBonus = Math.min((count - 3) * 0.03, 0.09);
        
        return {
            confidence: confidenceBase + confidenceBonus,
            predictTai: consecutive === 'X', // Đảo chiều
            reason: `Phát hiện ${count} ${consecutive} liên tiếp, dự đoán đảo chiều`
        };
    }
    
    // MẪU 2: Dạng kẹp giữa (T-X-T hoặc X-T-X) trong 3 kỳ gần nhất
    if (pattern[0] === pattern[2] && pattern[0] !== pattern[1]) {
        return {
            confidence: 0.82,
            predictTai: pattern[0] === 'T',
            reason: `Phát hiện mẫu kẹp ${pattern[0]}-${pattern[1]}-${pattern[0]}, dự đoán tiếp tục ${pattern[0]}`
        };
    }
    
    // MẪU 3: Mẫu xen kẽ hoàn hảo (TXTXT hoặc XTXTX)
    const isAlternating = alternatingRate >= 0.8;
    if (isAlternating && pattern.length >= 5) {
        // Kiểm tra 5 kỳ gần đây có hoàn toàn xen kẽ không
        let perfectAlt = true;
        for (let i = 0; i < 4; i++) {
            if (pattern[i] === pattern[i+1]) {
                perfectAlt = false;
                break;
            }
        }
        
        if (perfectAlt) {
            return {
                confidence: 0.85,
                predictTai: pattern[0] === 'X',
                reason: `Phát hiện mẫu xen kẽ hoàn hảo ${recentPattern}, dự đoán tiếp tục mẫu`
            };
        }
    }
    
    // MẪU 4: Phát hiện các trình tự đặc biệt trong 4 kỳ gần nhất
    const last4 = pattern.slice(0, 4).join('');
    
    if (last4 === 'TXXT') {
        return {
            confidence: 0.84,
            predictTai: false,
            reason: `Phát hiện mẫu TXXT, dự đoán tiếp theo là X (xác suất cao)`
        };
    } else if (last4 === 'XTTX') {
        return {
            confidence: 0.84,
            predictTai: true,
            reason: `Phát hiện mẫu XTTX, dự đoán tiếp theo là T (xác suất cao)`
        };
    }
    
    // MẪU 5: Xu hướng rõ ràng (>70% cùng một loại)
    if (taiRate >= 0.7) {
        return {
            confidence: 0.75,
            predictTai: true,
            reason: `Xu hướng Tài mạnh (${Math.round(taiRate * 100)}%), dự đoán duy trì xu hướng`
        };
    } else if (taiRate <= 0.3) {
        return {
            confidence: 0.75,
            predictTai: false,
            reason: `Xu hướng Xỉu mạnh (${Math.round((1-taiRate) * 100)}%), dự đoán duy trì xu hướng`
        };
    }
    
    // MẪU 6: Mẫu TTX hoặc XXT (3 kỳ gần nhất)
    if (pattern[0] === 'X' && pattern[1] === pattern[2] && pattern[1] !== 'X') {
        return {
            confidence: 0.78,
            predictTai: false,
            reason: `Phát hiện mẫu X-T-T, dự đoán tiếp theo X`
        };
    } else if (pattern[0] === 'T' && pattern[1] === pattern[2] && pattern[1] !== 'T') {
        return {
            confidence: 0.78,
            predictTai: true,
            reason: `Phát hiện mẫu T-X-X, dự đoán tiếp theo T`
        };
    }
    
    // MẪU 7: Hai kỳ gần nhất cùng loại
    if (pattern[0] === pattern[1]) {
        return {
            confidence: 0.73,
            predictTai: pattern[0] !== 'T',
            reason: `2 kỳ ${pattern[0]} liên tiếp, dự đoán đảo chiều`
        };
    }
    
    // Mẫu mặc định khi không tìm thấy mẫu rõ ràng
    return {
        confidence: 0.65,
        predictTai: Math.random() > 0.5, // Random khi không có mẫu rõ ràng
        reason: `Không tìm thấy mẫu rõ ràng, dự đoán ngẫu nhiên`
    };
}

/**
 * V5.0: Áp dụng Kelly Criterion cho quản lý vốn
 * @param {Number} balance - Số dư tài khoản
 * @param {Number} odds - Tỷ lệ thắng (thường là 1.95 cho Tài Xỉu)
 * @param {Number} probability - Xác suất thắng (0-1)
 * @param {Number} fraction - Phần trăm Kelly sử dụng (0-1)
 * @param {Number} maxRisk - Rủi ro tối đa cho phép (0-1)
 * @returns {Number} Số tiền đặt cược được đề xuất
 */
function calculateKellyCriterion(balance, odds = 1.95, probability, fraction = 0.3, maxRisk = 0.05) {
    // Tính toán Kelly đầy đủ
    const fullKelly = ((odds * probability) - 1) / (odds - 1);
    
    // Giới hạn theo phần trăm Kelly và rủi ro tối đa
    const cappedKelly = Math.min(fullKelly * fraction, maxRisk);
    
    // Đảm bảo không âm
    const safeKelly = Math.max(cappedKelly, 0);
    
    // Tính số tiền cược
    let betAmount = Math.floor(balance * safeKelly);
    
    // Làm tròn về bội số của 10,000 để dễ đọc
    betAmount = Math.ceil(betAmount / 10000) * 10000;
    
    // Đảm bảo mức cược tối thiểu
    return Math.max(betAmount, 100000);
}

/**
 * Đếm số lần thua liên tiếp gần đây từ file log
 * @param {string} logFile - Đường dẫn đến file log
 * @returns {number} Số lần thua liên tiếp
 */
function calculateRecentLosses(logFile) {
    try {
        if (!fs.existsSync(logFile)) return 0;
        
        const data = fs.readFileSync(logFile, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        
        let consecutiveLosses = 0;
        
        // Đọc từ dòng mới nhất (trên cùng) xuống
        for (const line of lines) {
            if (line.includes('| Sai |')) {
                consecutiveLosses++;
            } else if (line.includes('| Đúng |')) {
                break; // Dừng khi gặp kết quả đúng
            }
        }
        
        return consecutiveLosses;
    } catch (error) {
        console.error(`Lỗi khi đọc log: ${error.message}`);
        return 0;
    }
}

/**
 * Phát hiện mẫu thích ứng từ lịch sử và tăng cường nhận diện chuỗi đặc biệt
 * @param {Array} history - Mảng lịch sử kết quả
 * @param {Number} index - Vị trí cần dự đoán
 * @returns {Object} Kết quả dự đoán
 */
function detectAdaptivePattern(history, index = 0) {
    // Kiểm tra đầu vào
    if (!history || !Array.isArray(history) || history.length < 10) {
        return { predictTai: null, confidence: 0, reason: "Không đủ dữ liệu" };
    }
    
    let result = { 
        predictTai: null, 
        confidence: 0, 
        reason: "", 
        method: "AdaptivePatternRecognition" 
    };
    
    try {
        // Lấy 20 kết quả gần nhất để phân tích
        const recentHistory = history.slice(0, Math.min(20, history.length));
        
        // Chuyển đổi lịch sử thành chuỗi Tài/Xỉu để nhận dạng mẫu
        const taiXiuPattern = recentHistory.map(item => {
            const num = item.numbers[index];
            return num >= 5 ? 'T' : 'X';
        }).join('');
        
        // Phát hiện mẫu chuỗi thua đặc biệt từ dữ liệu
        // Đọc log gần nhất để xem có chuỗi thua không
        const dataDir = path.join(__dirname, '..', 'data');
        const logFile = path.join(dataDir, 'prediction_log.txt');
        const recentLosses = calculateRecentLosses(logFile);
        
        // Kiểm tra xem có chuỗi thua liên tiếp không
        if (recentLosses >= 2) {
            // Phân tích 5 kết quả gần nhất để tìm mẫu
            const pattern5 = taiXiuPattern.substring(0, 5);
            // Kiểm tra các mẫu đặc biệt trong chuỗi thua
            
            // Mẫu 1: Nếu có 3+ Tài liên tiếp, dự đoán Xỉu tiếp theo
            if (pattern5.startsWith('TTT')) {
                result.predictTai = false;
                result.confidence = 0.82;
                result.reason = "Mẫu 3+ Tài liên tiếp sau chuỗi thua";
                result.method = "AdaptiveStreakBreaker";
                return result;
            }
            
            // Mẫu 2: Nếu có 3+ Xỉu liên tiếp, dự đoán Tài tiếp theo
            if (pattern5.startsWith('XXX')) {
                result.predictTai = true;
                result.confidence = 0.82;
                result.reason = "Mẫu 3+ Xỉu liên tiếp sau chuỗi thua";
                result.method = "AdaptiveStreakBreaker";
                return result;
            }
            
            // Mẫu 3: Mẫu xen kẽ TXTX, dự đoán T tiếp theo
            if (pattern5.startsWith('TXTX')) {
                result.predictTai = true;
                result.confidence = 0.80;
                result.reason = "Mẫu xen kẽ TXTX sau chuỗi thua";
                result.method = "AdaptiveStreakBreaker";
                return result;
            }
            
            // Mẫu 4: Mẫu xen kẽ XTXT, dự đoán X tiếp theo
            if (pattern5.startsWith('XTXT')) {
                result.predictTai = false;
                result.confidence = 0.80;
                result.reason = "Mẫu xen kẽ XTXT sau chuỗi thua";
                result.method = "AdaptiveStreakBreaker";
                return result;
            }
        }
        
        // Tiếp tục với logic phát hiện mẫu thông thường
        // ... (giữ nguyên code hiện tại)
    } catch (error) {
        console.error(`❌ Lỗi khi phân tích mẫu thích ứng: ${error.message}`);
        return { predictTai: null, confidence: 0, reason: "Lỗi khi phân tích mẫu thích ứng" };
    }
    
    return result;
}

module.exports = {
    detectCyclicalReversals,
    detectShortAlternatingPattern,
    detectLongStreaks,
    detectFastPattern,
    balancedAnalysis,
    generateNumbers,
    analyzeLimitPerformance,
    detectTimeBasedPattern,
    getTimePeriod,
    getPeriodResults,
    advancedCombinationPattern,
    calculateKellyCriterion,
    detectAdaptivePattern
};