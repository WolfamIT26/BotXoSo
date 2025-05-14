const fs = require('fs');
const path = require('path');
const account = require('./account');
const loggerModule = require('./logger');
const predictorModule = require('./predictor');
const drawIdModule = require('./drawId');
const betRecords = require('./betRecords');
const { selectNumber, selectBettingOptions, placeBet } = require('../betAutomatic');
const config = require('./config');

// Thêm biến toàn cục để theo dõi drawId đã đặt cược gần đây
const recentlyBetDrawIds = new Set();
const RECENT_BET_EXPIRATION = 120000; // 2 phút

/**
 * Tạo dự đoán và lưu vào file
 */
async function makePrediction(shouldPredictTai, index, history, predictionsFile, historyLogFile, accountInfo, strategy, reason, page, log = true) {
  const predictedNumbers = predictorModule.generateNumbers(shouldPredictTai, index);
  const predictedNumber = predictedNumbers[index];
  const predictedType = shouldPredictTai ? 'Tài' : 'Xỉu';

  // Đảm bảo history hợp lệ
  if (!history || !Array.isArray(history) || history.length === 0) {
    if (log) console.log("⚠️ Không có dữ liệu lịch sử, không thể tạo dự đoán");
    return null;
  }

  // LUÔN sử dụng drawID từ history[0] (kỳ mới nhất)
  const currentDrawId = history[0].drawId;
  const newDrawId = drawIdModule.calculateSafeNextDrawId(currentDrawId, predictionsFile, historyLogFile);

  if (log) console.log(`🔢 DrawID hiện tại: ${currentDrawId}, DrawID tiếp theo: ${newDrawId}`);

  // Kiểm tra xem đã đặt cược cho drawId này chưa
  if (recentlyBetDrawIds.has(newDrawId)) {
    if (log) console.log(`⚠️ Đã đặt cược cho DrawID ${newDrawId} gần đây. Bỏ qua để tránh trùng lặp.`);
    return null;
  }

  const prediction = {
    drawId: newDrawId,
    numbers: predictedNumbers,
    detail: {
      index: index,
      prediction: predictedNumber,
      strategy: strategy,
      reason: reason
    },
    timestamp: new Date().toISOString()
  };

  try {
    // Lưu dự đoán cơ bản
    fs.writeFileSync(predictionsFile, JSON.stringify(prediction, null, 2), 'utf8');
    if (log) {
      console.log(`📊 Dự đoán: Số ${predictedNumber} (${predictedType}) tại vị trí ${index} - ${reason}`);
      console.log(`🎲 Mảng số: [${predictedNumbers.join(', ')}]`);
      console.log(`🧠 Phương pháp: ${strategy}`);
    }

    // Ghi log dự đoán cho mọi trường hợp, không phụ thuộc vào accountInfo
    const logSuccess = betRecords.logPrediction(prediction);
    if (logSuccess && log) {
      console.log(`✅ Đã ghi dự đoán vào log: DrawID ${prediction.drawId}`);
    } else if (!logSuccess && log) {
      console.log(`ℹ️ DrawID ${prediction.drawId} có thể đã được ghi log trước đó`);
    }

    if (accountInfo && account.canUseBetting(accountInfo)) {
      // THÊM KIỂM TRA NÀY: Kiểm tra lại enabled trước khi đặt cược
      if (!accountInfo.betting.enabled) {
        if (log) console.log(`⚠️ Cược tự động đã bị tắt với lý do: ${accountInfo.betting.disabledReason || "Không rõ"}`);
        return prediction;
      }

      // THÊM DÒNG NÀY: Đọc lại thông tin tài khoản từ file để đảm bảo consecutiveLosses mới nhất
      const accountFile = path.join(__dirname, '..', 'data', 'account.json');
      const freshAccountInfo = account.readAccountInfo(accountFile, false);
      account.checkAndResetBalance(accountInfo, accountFile, log, 1);

      // Thêm log để kiểm tra trạng thái trước khi tính tiền cược
      if (log) console.log(`🔍 Trước khi tính cược theo file: consecutiveLosses=${freshAccountInfo.betting.consecutiveLosses}, lastBetAmount=${freshAccountInfo.betting.lastBetAmount}`);

      // Sử dụng thông tin tài khoản đã được cập nhật để tính toán số tiền cược
      let betAmount = account.calculateBetAmount(freshAccountInfo, log);

      const balance = freshAccountInfo.betting.accountBalance;

      if (balance < betAmount) {
        console.log(`⚠️ Số dư (${balance.toLocaleString('vi-VN')}đ) không đủ để đặt cược (${betAmount.toLocaleString('vi-VN')}đ)`);

        // Thêm đoạn này để tắt chế độ cược khi số dư không đủ
        account.disableBetting(accountInfo, accountFile, `Số dư tài khoản không đủ: ${balance.toLocaleString('vi-VN')}đ < ${betAmount.toLocaleString('vi-VN')}đ`, log);
        console.log(`🔒 Đã tự động tắt chế độ đặt cược do số dư không đủ`);

      } else {
        prediction.bet = {
          amount: betAmount,  // Quan trọng: Sử dụng betAmount đã tính toán từ freshAccountInfo
          type: shouldPredictTai ? 'Tài' : 'Xỉu',
          status: 'pending',
          time: new Date().toISOString(),
          isDemo: account.isDemoMode(freshAccountInfo)
        };

        if (page && freshAccountInfo && freshAccountInfo.betting && freshAccountInfo.betting.enabled) {
          try {
            await selectNumber(page);
            await selectBettingOptions(page, shouldPredictTai ? 'tai' : 'xiu');
            const betSuccess = await placeBet(page, betAmount);

            if (betSuccess) {
              console.log(`✅ Đã đặt cược thành công ${betAmount.toLocaleString('vi-VN')}đ vào ${shouldPredictTai ? 'Tài' : 'Xỉu'} ${account.isDemoMode(freshAccountInfo) ? '[CHẾ ĐỘ THỬ]' : ''}`);

              // Thêm drawId vào danh sách đã đặt cược gần đây
              recentlyBetDrawIds.add(newDrawId);

              // Tự động xóa khỏi danh sách sau một khoảng thời gian
              setTimeout(() => {
                recentlyBetDrawIds.delete(newDrawId);
              }, RECENT_BET_EXPIRATION);
            } else {
              console.log(`⚠️ Có thể đã xảy ra lỗi khi đặt cược, vui lòng kiểm tra lại`);
            }
          } catch (error) {
            console.error(`❌ Lỗi khi đặt cược tự động: ${error.message}`);

            // Nếu lỗi liên quan đến selector không tìm thấy, tắt chế độ đặt cược
            if (error.message.includes("selector") || error.message.includes("Cannot read properties")) {
              console.log("⚠️ Không tìm thấy selector cược, tắt chế độ đặt cược tự động");

              // Chỉ disable khi đang enabled
              const accountFile = path.join(__dirname, '..', 'data', 'account.json');
              account.disableBetting(accountInfo, accountFile, `Lỗi không tìm thấy selector cược: ${error.message.substring(0, 100)}...`, log);

              // Xóa thông tin đặt cược trong prediction
              delete prediction.bet;
            }
          }
        } else {
          console.log(`ℹ️ Không thể đặt cược tự động vì không có tham số page`);
        }

        // Lưu thông tin cược vào file
        fs.writeFileSync(predictionsFile, JSON.stringify(prediction, null, 2), 'utf8');

        // THÊM DÒNG NÀY: Khi có bet, ghi vào file betting.txt
        betRecords.logBettingFromPrediction(prediction);
      }
    }
  } catch (error) {
    if (log) console.error(`❌ Lỗi khi ghi file dự đoán: ${error.message}`);
  }

  return prediction;
}

/**
 * Xử lý dự đoán trước đó và ghi log kết quả
 */
function processPreviousPrediction(predictionsFile, historyLogFile, history, accountInfo, log = true) {
  // Đảm bảo dữ liệu hợp lệ
  if (!history || !Array.isArray(history) || history.length === 0) {
    if (log) console.log("⚠️ Dữ liệu lịch sử không hợp lệ, không thể xử lý dự đoán cũ");
    return;
  }

  // THÊM DÒNG NÀY: Cập nhật tất cả các cược cũ trước khi xử lý cược mới
  betRecords.updateAllPendingBets(history, log);

  // Kiểm tra và tạo file dự đoán nếu nó chưa tồn tại
  if (!fs.existsSync(predictionsFile)) {
    if (log) console.log(`📄 File dự đoán không tồn tại, tạo file mới: ${predictionsFile}`);
    fs.writeFileSync(predictionsFile, '{}', 'utf8');
  }

  // Xử lý dự đoán từ file predictions.json (nếu có)
  if (fs.existsSync(predictionsFile)) {
    try {
      const oldPrediction = JSON.parse(fs.readFileSync(predictionsFile, 'utf8'));
      
      // Thêm kiểm tra để đảm bảo oldPrediction và oldPrediction.drawId tồn tại
      if (!oldPrediction || !oldPrediction.drawId) {
        if (log) console.log("⚠️ File dự đoán không chứa thông tin drawId hợp lệ, bỏ qua");
        return;
      }

      // THÊM DÒNG NÀY: Kiểm tra khoảng cách thời gian giữa oldPrediction và history[0]
      // Nếu có khoảng cách lớn, reset currentBalance
      const currentDrawId = history[0].drawId;
      const oldDrawId = oldPrediction.drawId;

      if (oldDrawId && currentDrawId) {
        const currentDay = currentDrawId.slice(0, 8);
        const oldDay = oldDrawId.slice(0, 8);
        const currentPeriod = parseInt(currentDrawId.slice(-4));
        const oldPeriod = parseInt(oldDrawId.slice(-4));

        // Tính khoảng cách giữa kỳ hiện tại và kỳ cũ
        let distance;

        if (currentDay === oldDay) {
          distance = Math.abs(currentPeriod - oldPeriod);
        } else {
          distance = 999; // Khác ngày -> buộc reset
        }

        if (distance > 30 && accountInfo && accountInfo.betting) {
          console.log(`⚠️ Phát hiện khoảng cách lớn: ${distance} kỳ (${oldDrawId} -> ${currentDrawId})`);

          // Reset currentBalance - CHỈ KHI accountInfo hợp lệ
          const accountFile = path.join(__dirname, '..', 'data', 'account.json');
          accountInfo.betting.currentBalance = 0;
          accountInfo.betting.consecutiveLosses = 0;
          account.saveAccountInfo(accountInfo, accountFile);

          console.log(`✅ Đã reset số dư và thống kê cược do khoảng cách lớn`);
        } else if (distance > 30) {
          // Vẫn log khi phát hiện khoảng cách lớn, kể cả khi không có accountInfo
          console.log(`ℹ️ Phát hiện khoảng cách lớn ${distance} kỳ nhưng không có thông tin tài khoản để reset`);
        }

        // Tính toán drawId tiếp theo dựa trên kỳ hiện tại
        const nextDrawId = drawIdModule.calculateSafeNextDrawId(currentDrawId, predictionsFile, historyLogFile);

        // Phân tích số kỳ từ nextDrawId
        const nextPeriod = parseInt(nextDrawId.slice(-4));
        const oldDrawIdNormalized = drawIdModule.normalizeDrawId(oldDrawId);
        const oldPeriodNormalized = parseInt(oldDrawIdNormalized.slice(-4));

        // Kiểm tra xem nextDrawId có cao hơn oldDrawId ít nhất 2 kỳ không
        // Ví dụ: oldDrawId = "202505091424", nextDrawId = "202505091426"
        const predictionJumpSize = nextPeriod - oldPeriodNormalized;

        if (predictionJumpSize < 1) {
          console.log(`ℹ️ Chưa đủ điều kiện để cập nhật kết quả cho kỳ ${oldDrawId}. Cần chờ sau kỳ ${nextPeriod - 1}`);
          return; // Không xử lý kết quả, chờ đến kỳ tiếp theo
        }

        console.log(`✅ Đủ điều kiện để cập nhật kết quả cho kỳ ${oldDrawId} (nhảy ${predictionJumpSize} kỳ)`);
      }

      if (log) console.log(`🔍 Đang tìm kết quả thực tế cho drawId: ${oldPrediction.drawId}`);

      // Tìm kết quả thực tế tương ứng với dự đoán cũ
      let actualResult = history.find(item => item.drawId === oldPrediction.drawId);

      // Nếu không tìm thấy kết quả chính xác, kiểm tra xem có thể là do định dạng drawId khác nhau
      if (!actualResult && history.length > 0) {
        // Thử chuyển đổi định dạng và tìm lại
        const cleanedPredictionId = oldPrediction.drawId.replace(/\D/g, '');  // Loại bỏ các ký tự không phải số
        actualResult = history.find(item => item.drawId.replace(/\D/g, '') === cleanedPredictionId);

        if (actualResult) {
          console.log(`✅ Tìm thấy kết quả sau khi chuẩn hóa định dạng drawId: ${actualResult.drawId}`);
        } else {
          // Tăng phạm vi tìm kiếm lên 5 kỳ thay vì chỉ 2 kỳ
          const sortedHistory = [...history].sort((a, b) => {
            return parseInt(b.drawId.replace(/\D/g, '')) - parseInt(a.drawId.replace(/\D/g, ''));
          });

          const searchLimit = 5; // Tăng từ 2 lên 5

          for (const item of sortedHistory) {
            const itemIdNum = parseInt(item.drawId.replace(/\D/g, ''));
            const predIdNum = parseInt(cleanedPredictionId);
            const difference = Math.abs(itemIdNum - predIdNum);

            if (difference <= searchLimit) {  // Tăng khoảng cách tìm kiếm
              actualResult = item;
              console.log(`⚠️ Không tìm thấy drawId chính xác. Sử dụng kết quả gần đó: ${actualResult.drawId} (chênh lệch ${difference} kỳ)`);
              break;
            }
          }

          // Nếu vẫn không tìm thấy, thử sử dụng kỳ hiện tại
          if (!actualResult && sortedHistory.length > 0) {
            actualResult = sortedHistory[0]; // Dùng kỳ mới nhất
            console.log(`⚠️ Không tìm thấy drawId tương đương. Sử dụng kỳ mới nhất: ${actualResult.drawId}`);
          }
        }
      }

      if (actualResult) {
        try {
          // Xác định vị trí index tương thích với cả cấu trúc cũ và mới
          let pos = 0; // Mặc định xem vị trí 0 là vị trí dự đoán

          // Nếu có trường detail theo cấu trúc cũ
          if (oldPrediction.detail && typeof oldPrediction.detail.index !== 'undefined') {
            pos = oldPrediction.detail.index;
            if (log) console.log(`🔍 Xác định vị trí index từ detail: ${pos}`);
          } else {
            // Nếu không có detail, sử dụng thông tin dự đoán từ reasonShort
            if (log) console.log(`⚠️ Không tìm thấy oldPrediction.detail, sử dụng vị trí mặc định: ${pos}`);
          }

          // Lấy số thực tế tại đúng vị trí index
          const actualNumber = parseInt(actualResult.numbers[pos]);

          // Xác định số dự đoán
          let predictedNumber;
          if (oldPrediction.detail && typeof oldPrediction.detail.prediction !== 'undefined') {
            // Cấu trúc cũ
            predictedNumber = oldPrediction.detail.prediction;
          } else {
            // Cấu trúc mới - lấy từ mảng numbers
            predictedNumber = oldPrediction.numbers[pos];
          }

          // Xác định Tài/Xỉu dựa trên số
          const actualType = actualNumber >= 5 ? "Tài" : "Xỉu";
          const predictedType = predictedNumber >= 5 ? "Tài" : "Xỉu";

          // Xác định phương pháp dự đoán
          let method = "Unknown";
          if (oldPrediction.detail && oldPrediction.detail.strategy) {
            method = oldPrediction.detail.strategy;
          } else if (oldPrediction.method) {
            method = oldPrediction.method;
          }

          // Kiểm tra kết quả dự đoán
          const isCorrect = (predictedType === actualType);
          
          // Hiển thị kết quả chi tiết
          if (log) {
            console.log(`📊 Kết quả dự đoán: DrawID ${oldPrediction.drawId}`);
            console.log(`🔢 Số dự đoán: ${predictedNumber} (${predictedType}) | Thực tế: ${actualNumber} (${actualType})`);
            console.log(`${isCorrect ? '🟢 ĐÚNG ✓' : '🔴 SAI ✗'} | Phương pháp: ${method}`);
          }

          // Ghi log kết quả đầy đủ
          let version = "v6.0.0"; // Cập nhật phiên bản mặc định
          try {
            // Lấy phiên bản từ config hoặc từ dự đoán
            if (oldPrediction.version) {
              version = oldPrediction.version;
            } else if (config && config.version) {
              version = config.version;
            }
          } catch (e) {
            console.error("Error loading version:", e.message);
          }
          
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
          const completeLogLine = `[${timeStr}] - ${oldPrediction.drawId} - Dự đoán: ${predictedNumber} (${predictedType}) | Số thực tế: ${actualNumber} (${actualType}) | ${isCorrect ? 'Đúng' : 'Sai'} | Phương pháp: ${method} | Vị trí: ${pos} | Phiên bản: ${version}\n`;

          // Kiểm tra xem đã có dòng log cho kỳ này chưa
          const predictionLogFile = path.join(path.dirname(historyLogFile), 'prediction_log.txt');
          let existingLog = '';
          if (fs.existsSync(predictionLogFile)) {
            existingLog = fs.readFileSync(predictionLogFile, 'utf8');
          }

          // Chỉ ghi log nếu chưa có cho kỳ này
          if (!existingLog.includes(`] - ${oldPrediction.drawId} - Dự đoán:`)) {
            fs.appendFileSync(predictionLogFile, completeLogLine, 'utf8');
            console.log(`✅ Đã ghi log kết quả đầy đủ cho DrawID ${oldPrediction.drawId}: ${isCorrect ? 'ĐÚNG' : 'SAI'}`);
          }

          // Cập nhật kết quả dự đoán vào file log (không liên quan đến cược)
          // betRecords.updatePredictionResult(oldPrediction, actualResult, isCorrect);

          // CẬP NHẬT CACHE HIỆU SUẤT
          if (oldPrediction.detail && oldPrediction.detail.strategy) {
            const method = oldPrediction.detail.strategy;
            // Kiểm tra xem hàm updateMethodPerformance có tồn tại trong môi trường hiện tại
            if (typeof global.updateMethodPerformance === 'function') {
              global.updateMethodPerformance(method, isCorrect);
            } else if (log) {
              console.log(`⚠️ Không thể cập nhật cache hiệu suất: hàm updateMethodPerformance không khả dụng`);
            }
          }

          // LUỒNG 2: XỬ LÝ KẾT QUẢ ĐẶT CƯỢC (chỉ khi có accountInfo)
          if (oldPrediction.bet && accountInfo && accountInfo.betting && accountInfo.betting.enabled) {
            console.log(`💰 Bắt đầu xử lý kết quả CỦA CƯỢC...`);
            const accountFilePath = path.join(__dirname, '..', 'data', 'account.json');

            // Kiểm tra kết quả cược - so sánh loại cược với loại thực tế tại vị trí index
            const betIsCorrect = (oldPrediction.bet.type === actualType);

            // Thêm log trước khi cập nhật
            console.log(`🔄 Cập nhật kết quả cược: ${betIsCorrect ? 'THẮNG' : 'THUA'} (${oldPrediction.bet.amount}đ)`);
            console.log(`📊 [TRƯỚC CẬP NHẬT] Thua liên tiếp=${accountInfo.betting.consecutiveLosses}, Số dư=${accountInfo.betting.currentBalance}`);

            // Thêm kiểm tra này
            if (betIsCorrect) {
              console.log(`⚠️ THẮNG: Xác nhận đặt lại consecutiveLosses = 0`);
            }

            account.updateBettingResult(accountFilePath, betIsCorrect, oldPrediction.bet.amount);

            // Thêm log sau khi cập nhật
            const updatedAccount = account.readAccountInfo(accountFilePath);
            console.log(`📊 [SAU CẬP NHẬT] Thua liên tiếp=${updatedAccount.betting.consecutiveLosses}, Số dư=${updatedAccount.betting.currentBalance}`);

            // Thêm mã kiểm tra để xác nhận reset consecutiveLosses khi thắng
            if (betIsCorrect && updatedAccount.betting.consecutiveLosses !== 0) {
              console.error(`❌ LỖI NGHIÊM TRỌNG: consecutiveLosses vẫn là ${updatedAccount.betting.consecutiveLosses} sau khi THẮNG!`);
            }

            // Thêm log tiền cược tiếp theo
            const nextBetAmount = account.calculateBetAmount(updatedAccount, false);
            console.log(`🔮 Tiền cược tiếp theo: ${nextBetAmount.toLocaleString('vi-VN')}đ`);

            // Cập nhật kết quả cược vào file betting.txt
            betRecords.updateBettingResult(
              oldPrediction.drawId,
              {
                numbers: actualResult.numbers,
                type: actualType,
                index: pos
              },
              betIsCorrect,
              pos,
              log,
              accountInfo  // Truyền accountInfo để kiểm tra
            );
          } else if (oldPrediction.bet) {
            console.log(`ℹ️ Có thông tin cược nhưng không xử lý vì thiếu accountInfo hoặc betting không được kích hoạt`);
            
            // Vẫn cập nhật kết quả trong betting.txt kể cả khi không có accountInfo
            const betIsCorrect = (oldPrediction.bet.type === actualType);
            betRecords.updateBettingResult(
              oldPrediction.drawId,
              {
                numbers: actualResult.numbers,
                type: actualType,
                index: pos
              },
              betIsCorrect,
              pos,
              log,
              null  // Truyền null để betRecords biết không cần kiểm tra accountInfo
            );
          }

          // Hiển thị thống kê gần đây
          try {
            const stats = loggerModule.analyzeRecentStats(historyLogFile);
            console.log(`📊 Thống kê gần đây: ${stats.correct}/${stats.total} đúng (${Math.round(stats.rate * 100)}%)`);
          } catch (error) {
            console.error(`❌ Lỗi khi phân tích thống kê: ${error.message}`);
          }
        } catch (error) {
          if (log) console.error(`❌ Lỗi khi xử lý dự đoán: ${error.message}`);
        }
      } else {
        console.log("⚠️ Không tìm thấy kết quả thực tế cho dự đoán, bỏ qua chu kỳ này");
      }
    } catch (error) {
      console.error(`❌ Lỗi khi xử lý dự đoán cũ từ file: ${error.message}`);
    }
  } else {
    console.log("📊 Không có dự đoán cũ từ file cần xử lý");
  }

  // Xử lý các dự đoán đang đợi trong cache toàn cục
  if (global.pendingPredictions && Object.keys(global.pendingPredictions).length > 0) {
    console.log(`🔍 Xử lý ${Object.keys(global.pendingPredictions).length} dự đoán từ cache toàn cục`);

    // Lặp qua tất cả các dự đoán trong cache
    for (const [pendingDrawId, pendingPred] of Object.entries(global.pendingPredictions)) {
      try {
        const normalizedPendingDrawId = drawIdModule.normalizeDrawId(pendingDrawId);

        // Tìm kết quả cho dự đoán đang đợi
        let pendingResult = history.find(item =>
          item.drawId === pendingDrawId ||
          drawIdModule.normalizeDrawId(item.drawId) === normalizedPendingDrawId
        );

        if (pendingResult) {
          // Có kết quả cho dự đoán này, ghi log đầy đủ
          const pendingPos = pendingPred.detail.index;
          const pendingActualNumber = parseInt(pendingResult.numbers[pendingPos]);
          const pendingPredictedNumber = pendingPred.numbers[pendingPos];

          // Xác định Tài/Xỉu
          const pendingActualType = pendingActualNumber >= 5 ? "Tài" : "Xỉu";
          const pendingPredictedType = pendingPredictedNumber >= 5 ? "Tài" : "Xỉu";

          // Kiểm tra kết quả
          const pendingIsCorrect = (pendingPredictedType === pendingActualType);

          // Ghi log kết quả đầy đủ
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

          // Nạp phiên bản từ config nếu có
          try {
            version = config.version || version;
          } catch (e) {
            console.error("Error loading config version:", e.message);
          }

          // Kiểm tra xem đã có log cho kỳ này chưa
          const predictionLogFile = path.join(path.dirname(historyLogFile), 'prediction_log.txt');
          let existingLog = '';
          if (fs.existsSync(predictionLogFile)) {
            existingLog = fs.readFileSync(predictionLogFile, 'utf8');
          }

          if (!existingLog.includes(`] - ${pendingDrawId} - Dự đoán:`) &&
            !existingLog.includes(`] - ${normalizedPendingDrawId} - Dự đoán:`)) {
            const completeLogLine = `[${timeStr}] - ${pendingDrawId} - Dự đoán: ${pendingPredictedNumber} (${pendingPredictedType}) | Số thực tế: ${pendingActualNumber} (${pendingActualType}) | ${pendingIsCorrect ? 'Đúng' : 'Sai'} | Phương pháp: ${pendingPred.detail.strategy} | Vị trí: ${pendingPos} | Phiên bản: ${version}\n`;

            // Tạo thư mục nếu chưa tồn tại
            if (!fs.existsSync(path.dirname(predictionLogFile))) {
              fs.mkdirSync(path.dirname(predictionLogFile), { recursive: true });
            }

            // Ghi vào đầu file, giữ lại log cũ
            let currentLogContent = '';
            if (fs.existsSync(predictionLogFile)) {
              currentLogContent = fs.readFileSync(predictionLogFile, 'utf8');
            }
            
            // Kiểm tra thêm lần nữa để tránh trường hợp trùng lặp
            if (!currentLogContent.includes(`] - ${pendingDrawId} - Dự đoán:`) && 
                !currentLogContent.includes(`] - ${normalizedPendingDrawId} - Dự đoán:`)) {
              fs.writeFileSync(predictionLogFile, completeLogLine + currentLogContent, 'utf8');
              console.log(`✅ Đã ghi log kết quả đầy đủ cho DrawID ${pendingDrawId}: ${pendingIsCorrect ? 'ĐÚNG' : 'SAI'}`);
            } else {
              console.log(`ℹ️ Dự đoán cho DrawID ${pendingDrawId} đã tồn tại trong log, không ghi lại.`);
            }

            // Cập nhật cache hiệu suất cho pendingPredictions
            if (pendingPred.detail && pendingPred.detail.strategy) {
              const pendingMethod = pendingPred.detail.strategy;
              if (typeof global.updateMethodPerformance === 'function') {
                global.updateMethodPerformance(pendingMethod, pendingIsCorrect);
                console.log(`📊  ${pendingMethod}: ${pendingIsCorrect ? 'Đúng' : 'Sai'} (từ cache)`);
              }
            }

            // Xóa từ cache sau khi đã xử lý
            delete global.pendingPredictions[pendingDrawId];
          }
        }
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý dự đoán từ cache: ${error.message}`);
      }
    }
  }
}

/**
 * Đặt cược dựa trên dự đoán
 * @param {Object} prediction - Dự đoán
 * @param {Function} betCallback - Callback để thực hiện đặt cược
 * @param {Boolean} log - Có ghi log hay không
 * @returns {Object} Kết quả đặt cược
 */
exports.placeBet = async function (prediction, betCallback, log = false) {
  if (!prediction) {
    if (log) console.log("❌ Không có dự đoán để đặt cược");
    return null;
  }

  // Kiểm tra độ tin cậy của dự đoán
  const confidenceThreshold = config.analysis.confidenceThreshold || 0.72;
  if (prediction.confidence < confidenceThreshold) {
    if (log) console.log(`🚫 Bỏ qua đặt cược cho lượt ${prediction.drawId} do độ tin cậy thấp (${(prediction.confidence * 100).toFixed(1)}%)`);
    return {
      success: false,
      skipped: true,
      reason: `Độ tin cậy thấp ${(prediction.confidence * 100).toFixed(1)}%`,
      drawId: prediction.drawId
    };
  }

  const currentHour = new Date().getHours();
  const dayOfWeek = new Date().getDay(); // 0 = Chủ nhật, 1-6 = Thứ 2 - Thứ 7

  // Kiểm tra xem có nên đặt cược hay không
  if (!shouldBetNow(currentHour, dayOfWeek, log)) {
    if (log) console.log(`⏱️ Không phải thời gian đặt cược, bỏ qua`);
    return { success: false, reason: "Ngoài thời gian đặt cược", drawId: prediction.drawId };
  }

  try {
    // Đọc lịch sử đặt cược
    const betHistory = readBetHistory();

    // Xác định mức cược dựa trên chiến lược
    const betAmount = determineBetAmount(betHistory, prediction.confidence, log);

    if (betAmount <= 0) {
      if (log) console.log(`💲 Bỏ qua cược do mức cược ${betAmount} ≤ 0`);
      return { success: false, reason: "Mức cược không hợp lệ", drawId: prediction.drawId };
    }

    // Kiểm tra giới hạn cược hàng ngày
    const todayBets = countTodayBets(betHistory);
    const dailyLimit = config.betting.dailyBetLimit || 20;

    if (todayBets >= dailyLimit) {
      if (log) console.log(`🛑 Đã đạt giới hạn ${dailyLimit} cược trong ngày, bỏ qua`);
      return { success: false, reason: "Đã đạt giới hạn cược hàng ngày", drawId: prediction.drawId };
    }

    // V4.0: Kiểm tra số lần thua liên tiếp để xem có cần nghỉ không
    const consecutiveLosses = countConsecutiveLosses(betHistory);
    const lossThreshold = config.betting.restAfterLosses || 5;
    const restPeriod = config.betting.restPeriod || 3;

    if (consecutiveLosses >= lossThreshold) {
      if (log) console.log(`😓 Đã thua ${consecutiveLosses} lần liên tiếp, nghỉ ${restPeriod} lượt`);

      // Kiểm tra xem đã nghỉ đủ số lượt chưa
      const lastBetTime = getLastBetTime(betHistory);
      const currentTime = new Date().getTime();
      const elapsedMinutes = (currentTime - lastBetTime) / (1000 * 60);

      // Ước tính số lượt đã bỏ qua (mỗi lượt khoảng 45s)
      const skippedRounds = Math.floor(elapsedMinutes * (60 / 45));

      if (skippedRounds < restPeriod) {
        if (log) console.log(`⏳ Đã nghỉ ${skippedRounds}/${restPeriod} lượt, tiếp tục nghỉ`);
        return {
          success: false,
          reason: `Nghỉ sau khi thua liên tiếp (${skippedRounds}/${restPeriod} lượt)`,
          drawId: prediction.drawId
        };
      } else {
        if (log) console.log(`✅ Đã nghỉ đủ ${restPeriod} lượt sau khi thua liên tiếp, tiếp tục đặt cược`);
      }
    }

    // Thực hiện đặt cược
    if (log) console.log(`💰 Đặt cược ${betAmount} cho lượt ${prediction.drawId} - Dự đoán: ${prediction.detail.prediction} (${prediction.reasonShort})`);

    const betResult = await betCallback(prediction, betAmount);

    if (betResult && betResult.success) {
      // Lưu thông tin cược vào lịch sử
      const betInfo = {
        drawId: prediction.drawId,
        amount: betAmount,
        prediction: prediction.detail.prediction,
        method: prediction.method,
        confidence: prediction.confidence,
        timestamp: new Date().toISOString(),
        result: null // Sẽ được cập nhật sau khi có kết quả
      };

      saveBet(betInfo);

      if (log) console.log(`✅ Đặt cược thành công cho lượt ${prediction.drawId}`);
      return {
        success: true,
        amount: betAmount,
        prediction: prediction.detail.prediction,
        drawId: prediction.drawId,
        betInfo: betInfo
      };
    } else {
      if (log) console.log(`❌ Đặt cược thất bại cho lượt ${prediction.drawId}: ${betResult ? betResult.error : 'Unknown error'}`);
      return {
        success: false,
        reason: betResult ? betResult.error : "Lỗi không xác định",
        drawId: prediction.drawId
      };
    }
  } catch (error) {
    console.error(`Lỗi khi đặt cược: ${error.message}`);
    return {
      success: false,
      reason: `Lỗi: ${error.message}`,
      drawId: prediction.drawId
    };
  }
};

/**
 * Đọc lịch sử đặt cược
 * @returns {Array} Mảng chứa thông tin các lượt đặt cược
 */
function readBetHistory() {
  try {
    const historyPath = path.join(__dirname, '../data/bet_history.json');
    if (fs.existsSync(historyPath)) {
      const historyData = fs.readFileSync(historyPath, 'utf8');
      return JSON.parse(historyData);
    }
    return [];
  } catch (error) {
    console.error(`Lỗi khi đọc lịch sử cược: ${error.message}`);
    return [];
  }
}

/**
 * Lưu lịch sử đặt cược
 * @param {Array} history - Mảng chứa thông tin các lượt đặt cược
 */
function saveBetHistory(history) {
  try {
    const historyPath = path.join(__dirname, '../data/bet_history.json');
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error(`Lỗi khi lưu lịch sử cược: ${error.message}`);
  }
}

/**
 * Thêm một lượt cược vào lịch sử
 * @param {Object} betInfo - Thông tin lượt cược
 */
function saveBet(betInfo) {
  try {
    const history = readBetHistory();
    history.push(betInfo);
    saveBetHistory(history);
  } catch (error) {
    console.error(`Lỗi khi lưu cược: ${error.message}`);
  }
}

/**
 * Đếm số lượt cược trong ngày hôm nay
 * @param {Array} history - Lịch sử cược
 * @returns {Number} Số lượt cược trong ngày
 */
function countTodayBets(history) {
  const today = new Date().toISOString().split('T')[0];
  return history.filter(bet => bet.timestamp.startsWith(today)).length;
}

/**
 * Tính số lần thua liên tiếp gần đây nhất
 * @param {Array} history - Lịch sử cược
 * @returns {Number} Số lần thua liên tiếp
 */
function countConsecutiveLosses(history) {
  // Lọc các cược đã có kết quả và sắp xếp theo thời gian giảm dần
  const completedBets = history
    .filter(bet => bet.result !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let losses = 0;

  for (const bet of completedBets) {
    if (bet.result && !bet.result.win) {
      losses++;
    } else {
      break; // Dừng nếu gặp lần thắng
    }
  }

  return losses;
}

/**
 * Lấy thời gian đặt cược gần đây nhất
 * @param {Array} history - Lịch sử cược
 * @returns {Number} Timestamp của lần cược gần nhất
 */
function getLastBetTime(history) {
  if (history.length === 0) return 0;

  // Sắp xếp theo thời gian giảm dần
  const sortedHistory = [...history].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return new Date(sortedHistory[0].timestamp).getTime();
}

/**
 * Xác định số tiền cược dựa trên chiến lược
 * @param {Array} history - Lịch sử cược
 * @param {Number} confidence - Độ tin cậy của dự đoán (0-1)
 * @param {Boolean} log - Có ghi log hay không
 * @returns {Number} Số tiền cược
 */
function determineBetAmount(history, confidence, log = false) {
  // V5.0: Lấy chiến lược cược từ config
  const strategy = config.betting.strategy || "fixed";
  const baseBet = config.betting.baseBet || 1000;
  const maxBet = config.betting.maxBet || 10000;

  // Tính toán số lần thắng/thua liên tiếp gần đây
  const recentBets = history
    .filter(bet => bet.result !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 15); // V5.0: Xem xét 15 lần cược gần nhất thay vì 10

  let consecutiveWins = 0;
  let consecutiveLosses = 0;

  // Đếm số lần thắng/thua liên tiếp
  for (const bet of recentBets) {
    if (bet.result.win) {
      if (consecutiveLosses > 0) break;
      consecutiveWins++;
    } else {
      if (consecutiveWins > 0) break;
      consecutiveLosses++;
    }
  }

  // V5.0: Tính tỷ lệ thắng của 30 lần cược gần nhất để ước tính xác suất
  const recentLongTermBets = history
    .filter(bet => bet.result !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 30);

  const winCount = recentLongTermBets.filter(bet => bet.result.win).length;
  const estimatedWinProbability = recentLongTermBets.length > 0
    ? winCount / recentLongTermBets.length
    : 0.5; // Mặc định 50% nếu không có dữ liệu

  // Điều chỉnh xác suất dựa trên độ tin cậy của dự đoán hiện tại
  const adjustedProbability = (estimatedWinProbability * 0.7) + (confidence * 0.3);

  // Tính toán số tiền cược dựa trên chiến lược
  let betAmount = baseBet;

  if (config.betting.useKellyCriterion) {
    // V5.0: Sử dụng Kelly Criterion nếu đã bật 
    const balance = getAccountBalance() || 10000000; // 10M mặc định nếu không tìm thấy
    const odds = config.betting.winMultiplier || 1.95; // Tỷ lệ thắng cược (1.95 cho Tài Xỉu)
    const kellyFraction = config.betting.kellyFraction || 0.3; // Phần trăm Kelly sử dụng
    const maxRisk = config.betting.maxRiskPerBet || 0.05; // Rủi ro tối đa

    // Sử dụng hàm từ predictor.js nếu có, không thì tính toán tại chỗ
    if (typeof predictorModule.calculateKellyCriterion === 'function') {
      betAmount = predictorModule.calculateKellyCriterion(
        balance, odds, adjustedProbability, kellyFraction, maxRisk
      );

      if (log) console.log(`💰 V5.0: Sử dụng Kelly Criterion (${Math.round(adjustedProbability * 100)}% win probability)`);
    } else {
      // Tính Kelly trực tiếp nếu không có hàm từ predictor
      const fullKelly = ((odds * adjustedProbability) - 1) / (odds - 1);
      const cappedKelly = Math.min(fullKelly * kellyFraction, maxRisk);
      const safeKelly = Math.max(cappedKelly, 0);

      betAmount = Math.floor(balance * safeKelly);
      betAmount = Math.ceil(betAmount / 10000) * 10000; // Làm tròn lên
      betAmount = Math.max(betAmount, 100000); // Tối thiểu 100k

      if (log) console.log(`💰 V5.0: Tính Kelly trực tiếp (${Math.round(adjustedProbability * 100)}% win probability)`);
    }
  } else {
    // Các chiến lược đặt cược cũ
    switch (strategy) {
      case "fixed":
        // Cược cố định theo mức cơ bản
        betAmount = baseBet;
        break;

      case "confidence":
        // Điều chỉnh theo độ tin cậy của dự đoán
        // Ví dụ: độ tin cậy 0.8 sẽ đặt cược 80% mức tối đa
        betAmount = Math.floor(baseBet + (confidence * (maxBet - baseBet)));
        break;

      case "martingale":
        // Chiến lược Martingale: Nhân đôi cược sau mỗi lần thua
        if (consecutiveLosses > 0) {
          betAmount = baseBet * Math.pow(2, consecutiveLosses);
        } else {
          betAmount = baseBet;
        }
        break;

      case "adaptive":
        // Kết hợp độ tin cậy và chuỗi thắng/thua để điều chỉnh mức cược
        if (consecutiveLosses > 0) {
          // Tăng mức cược nhưng với tốc độ chậm hơn Martingale
          betAmount = baseBet * (1 + (0.5 * consecutiveLosses));
        } else if (consecutiveWins > 0) {
          // Tăng nhẹ mức cược sau mỗi lần thắng
          betAmount = baseBet * (1 + (0.2 * consecutiveWins));
        }

        // Điều chỉnh thêm dựa vào độ tin cậy
        betAmount = Math.floor(betAmount * (0.8 + (confidence * 0.4)));
        break;

      default:
        betAmount = baseBet;
    }
  }

  // Giới hạn mức cược trong phạm vi cho phép
  betAmount = Math.max(baseBet, Math.min(maxBet, betAmount));

  if (log) {
    if (config.betting.useKellyCriterion) {
      console.log(`💰 V5.0: Kelly Criterion - Mức cược: ${betAmount.toLocaleString('vi-VN')}đ (xác suất thắng: ${(adjustedProbability * 100).toFixed(1)}%)`);
    } else {
      console.log(`💰 Chiến lược "${strategy}" - Mức cược: ${betAmount.toLocaleString('vi-VN')}đ (độ tin cậy: ${(confidence * 100).toFixed(1)}%)`);
    }

    if (consecutiveWins > 0) console.log(`🔥 Chuỗi thắng: ${consecutiveWins}`);
    if (consecutiveLosses > 0) console.log(`😓 Chuỗi thua: ${consecutiveLosses}`);
  }

  return betAmount;
}

/**
 * V5.0: Lấy số dư tài khoản hiện tại
 * @returns {Number} Số dư tài khoản
 */
function getAccountBalance() {
  try {
    const accountFile = path.join(__dirname, '..', 'data', 'account.json');
    if (fs.existsSync(accountFile)) {
      const accountInfo = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
      if (accountInfo && accountInfo.betting && typeof accountInfo.betting.accountBalance === 'number') {
        return accountInfo.betting.accountBalance;
      }
    }
    return config.betting.initialBalance || 10000000; // Mặc định 10M nếu không tìm thấy
  } catch (error) {
    console.error(`❌ Lỗi khi đọc số dư tài khoản: ${error.message}`);
    return config.betting.initialBalance || 10000000;
  }
}

module.exports = {
  makePrediction,
  processPreviousPrediction,
  placeBet,
  readBetHistory,
  saveBet,
  countTodayBets,
  countConsecutiveLosses,
  determineBetAmount,
  getAccountBalance
};
