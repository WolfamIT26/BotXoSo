const TelegramBot = require('node-telegram-bot-api');
const predictors = require('./predictors/index');
const { getAllLotteryNumbers } = require('./database/dataAccess');
const path = require('path');

// Thay thế 'YOUR_BOT_TOKEN' bằng token của bot bạn nhận được từ BotFather
const token = '7706655307:AAHHaUYz0wPCVTIDd_ho2lWSZXkmLUmqxF8';
// Chat ID của group
const CHAT_ID = '-1002674937562';

console.log('🔑 Token bot:', token);
console.log('💬 Chat ID:', CHAT_ID);

// Tạo một bot instance với cấu hình đơn giản
const bot = new TelegramBot(token, { polling: false });

// Xử lý lỗi
bot.on('error', (error) => {
    console.error('❌ Lỗi Telegram bot:', error);
});

let currentStart = null;
let currentEnd = null;
let currentStep = 1;
let currentType = null;
let runningInterval = null;
let lastCheckedDrawId = null;
let lastMessageId = null;
let keoHistory = [];


const HUONG_DAN_MESSAGE =
    "📣 MIỀN BẮC VIP 45 GIÂY 🏆✨\n" +
    "🌟 KÈO Số Đầu ✨✨\n" +
    "🔸 Cách chơi:\n" +
    "👉 Số đầu của giải đặc biệt từ 0-4 là Xỉu\n" +
    "👉 Số đầu của giải đặc biệt từ 5-9 là Tài\n\n" +
    "🔸 Cách chia vốn:\n" +
    "Đánh theo tỷ lệ: 1-3-8-20-48-112-256\n\n" +
    "💰💰 Cách chơi 💰💰\n" +
    "Đánh theo kỳ hô (ví dụ 220-227) thì đánh theo bot hô, nếu thua thì đánh gấp thếp lên theo tỷ lệ (1-3-8-20-48-112-256) đến khi được húp thì đợi kỳ hô tiếp theo và quay về đánh x1.\n";
function getKeoHistoryAndCurrentLine(currentLine) {
    const recentHistory = keoHistory.slice(-7); // Lấy 7 dòng gần nhất
    return [...recentHistory, currentLine];
}


// Hàm khởi động bot tự động
async function startBot() {
    console.log('🚀 Khởi động bot tự động...');
    
    // Lấy kỳ hiện tại từ drawId (3 số cuối)
    const historicalData = await getAllLotteryNumbers();
    if (!historicalData || historicalData.length === 0) return;
    const latest = historicalData[0];
    const drawIdStr = latest.drawId.toString();
    const currentKy = parseInt(drawIdStr.slice(-3), 10);
    console.log('drawIdStr:', drawIdStr, 'currentKy:', currentKy);
    currentStart = currentKy;
    currentEnd = currentStart + 6;
    currentStep = 1;

    // Dự đoán Tài/Xỉu
    let predictions = await predictors.predict(null, historicalData, 0, false);
    console.log('DEBUG predictions:', predictions);

    if (predictions && typeof predictions.prediction === 'boolean') {
        currentType = predictions.prediction ? 'Tài' : 'Xỉu';
    } else if (predictions && predictions.doanTaiXiu) {
        currentType = predictions.doanTaiXiu;
    } else if (predictions && Array.isArray(predictions.numbers) && predictions.numbers.length > 0) {
        currentType = predictions.numbers[0] >= 5 ? 'Tài' : 'Xỉu';
    } else {
        currentType = 'Xỉu'; // fallback
    }

    await sendKeoAndHistory(CHAT_ID, 'Đợi');

    runningInterval = setInterval(async () => {
        const data = await getAllLotteryNumbers();
        if (!data || data.length === 0) return;
        const nowDrawIdStr = data[0].drawId.toString();
        const nowKy = parseInt(nowDrawIdStr.slice(-3), 10);

        // Chỉ kiểm tra khi có drawId mới
        if (lastCheckedDrawId === nowDrawIdStr) return;
        lastCheckedDrawId = nowDrawIdStr;

        // Nếu kỳ hiện tại nằm trong chuỗi
        if (nowKy >= currentStart && nowKy <= currentEnd) {
            const sodau = data[0].numbers[0];
            const ketQua = sodau >= 5 ? 'Tài' : 'Xỉu';
            console.log('DEBUG:', { sodau, ketQua, currentType, nowKy, currentStart, currentEnd });
            if (ketQua === currentType) {
                // THẮNG
                await sendKeoAndHistory(CHAT_ID, 'Húp 🎉');
                keoHistory.push(`${currentStart}-${currentEnd} gấp thếp ${currentStep} [${currentType}] Húp 🎉`);
                // Reset gấp thếp, chuyển kỳ mới
                currentStart = nowKy + 1;
                currentEnd = currentStart + 6;
                currentStep = 1;
                let predictions = await predictors.predict(null, data, 0, false);
                console.log('DEBUG predictions:', predictions);

                if (predictions && typeof predictions.prediction === 'boolean') {
                    currentType = predictions.prediction ? 'Tài' : 'Xỉu';
                } else if (predictions && predictions.doanTaiXiu) {
                    currentType = predictions.doanTaiXiu;
                } else if (predictions && Array.isArray(predictions.numbers) && predictions.numbers.length > 0) {
                    currentType = predictions.numbers[0] >= 5 ? 'Tài' : 'Xỉu';
                } else {
                    currentType = 'Xỉu'; // fallback
                }
                await sendKeoAndHistory(CHAT_ID, 'ĐỢI');
            } else {
                // THUA
                if (currentStep >= 7) {
                    // Gãy
                    await sendKeoAndHistory(CHAT_ID, 'Gãy 💥');
                    keoHistory.push(`${currentStart}-${currentEnd} gấp thếp ${currentStep} [${currentType}] Gãy 💥`);

                    // Reset gấp thếp, chuyển kỳ mới
                    currentStart = nowKy + 1;
                    currentEnd = currentStart + 6;
                    currentStep = 1;
                    let predictions = await predictors.predict(null, data, 0, false);
                    console.log('DEBUG predictions:', predictions);

                    if (predictions && typeof predictions.prediction === 'boolean') {
                        currentType = predictions.prediction ? 'Tài' : 'Xỉu';
                    } else if (predictions && predictions.doanTaiXiu) {
                        currentType = predictions.doanTaiXiu;
                    } else if (predictions && Array.isArray(predictions.numbers) && predictions.numbers.length > 0) {
                        currentType = predictions.numbers[0] >= 5 ? 'Tài' : 'Xỉu';
                    } else {
                        currentType = 'Xỉu'; // fallback
                    }
                    await sendKeoAndHistory(CHAT_ID, 'ĐỢI');
                } else {
                    // Tăng gấp thếp
                    currentStep += 1;
                    await sendKeoAndHistory(CHAT_ID, 'ĐỢI');
                }
            }
        }

        console.log('Kỳ mới nhất trong DB:', nowDrawIdStr, 'Thời gian:', new Date().toLocaleTimeString());
        console.log('Cập nhật currentType:', currentType);
    }, 3000); // kiểm tra mỗi 3 giây
}

function formatHistoryMessage(historyMessages, lastLine) {
    return HUONG_DAN_MESSAGE + historyMessages.join('\n') + '\n' + lastLine;
}

async function sendKeoAndHistory(chatId, trangThai = 'ĐỢI') {
    const line = `${currentStart}-${currentEnd} gấp thếp ${currentStep} [${currentType}] ${trangThai}`;
    const historyMessages = getKeoHistoryAndCurrentLine(line);

    // Lấy kỳ và drawId tiếp theo
    const historicalData = await getAllLotteryNumbers();
    let lastLine = '';
    if (historicalData && historicalData.length > 0) {
        const latestDrawId = historicalData[0].drawId.toString();
        const latestKy = parseInt(latestDrawId.slice(-3), 10);
        const nextKy = latestKy + 1;
        const prefix = latestDrawId.slice(0, -3);
        const nextKyStr = nextKy.toString().padStart(3, '0');
        const nextDrawId = prefix + nextKyStr;
        lastLine = `${nextKy} kỳ Số Phiên: ${nextDrawId}=❓`;
    } else {
        lastLine = '??? kỳ Số Phiên: ???=?';
    }

    // Gộp thành 1 tin nhắn
    const message = formatHistoryMessage(historyMessages, lastLine);
    await bot.sendMessage(chatId, message);
}

// Hàm gửi thông báo tự động
async function sendAutoNotification(message) {
    try {
        console.log('📤 Gửi thông báo đến chat:', CHAT_ID);
        console.log('📝 Nội dung:', message);
        await bot.sendMessage(CHAT_ID, message);
        console.log('✅ Gửi thông báo thành công');
    } catch (error) {
        console.error('❌ Lỗi khi gửi thông báo tự động:', error);
    }
}

// Khởi động bot
bot.startPolling({ polling: true });
// Tự động bắt đầu gửi kèo
startBot();

// Export bot instance và hàm gửi thông báo
module.exports = {
    bot,
    sendAutoNotification
}; 