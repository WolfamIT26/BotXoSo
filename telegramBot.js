const TelegramBot = require('node-telegram-bot-api');
const predictors = require('./predictors/index');
const { getAllLotteryNumbers } = require('./database/dataAccess');
const path = require('path');
const connectDB = require('./config/database');
const dataCollector = require('./collectors/dataCollector');
const dataStorage = require('./database/dataStorage');
const { openBettingPage, launchBrowser, getCountDownTime, deleteServiceFloat } = require('./betAutomatic');

// Thay thế 'YOUR_BOT_TOKEN' bằng token của bot bạn nhận được từ BotFather
const token = '7706655307:AAHHaUYz0wPCVTIDd_ho2lWSZXkmLUmqxF8';
// Chat ID của các group
const CHAT_IDS = ['-1002674937562', '-1002570715628'];

console.log('🔑 Token bot:', token);
console.log('💬 Chat IDs:', CHAT_IDS);

// Tạo một bot instance với cấu hình đơn giản
const bot = new TelegramBot(token, { polling: true });

// Xử lý lỗi
bot.on('error', (error) => {
    console.error('❌ Lỗi Telegram bot:', error);
});

// Xử lý khi bot khởi động thành công
bot.on('polling_error', (error) => {
    console.error('❌ Lỗi polling:', error);
});

bot.on('webhook_error', (error) => {
    console.error('❌ Lỗi webhook:', error);
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

    await sendKeoAndHistory(CHAT_IDS[0], 'Đợi');

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
                await sendKeoAndHistory(CHAT_IDS[0], 'Húp 🎉');
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
                await sendKeoAndHistory(CHAT_IDS[0], 'ĐỢI');
            } else {
                // THUA
                if (currentStep >= 7) {
                    // Gãy
                    await sendKeoAndHistory(CHAT_IDS[0], 'Gãy 💥');
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
                    await sendKeoAndHistory(CHAT_IDS[0], 'ĐỢI');
                } else {
                    // Tăng gấp thếp
                    currentStep += 1;
                    await sendKeoAndHistory(CHAT_IDS[0], 'ĐỢI');
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
    
    // Gửi tin nhắn đến tất cả các nhóm
    for (const chatId of CHAT_IDS) {
        try {
            await bot.sendMessage(chatId, message);
        } catch (error) {
            console.error(`❌ Lỗi khi gửi tin nhắn đến nhóm ${chatId}:`, error);
        }
    }
}

// Hàm gửi thông báo tự động
async function sendAutoNotification(message) {
    try {
        console.log('📤 Gửi thông báo đến các nhóm:', CHAT_IDS);
        console.log('📝 Nội dung:', message);
        
        // Gửi tin nhắn đến tất cả các nhóm
        for (const chatId of CHAT_IDS) {
            try {
                await bot.sendMessage(chatId, message);
            } catch (error) {
                console.error(`❌ Lỗi khi gửi thông báo đến nhóm ${chatId}:`, error);
            }
        }
        console.log('✅ Gửi thông báo thành công');
    } catch (error) {
        console.error('❌ Lỗi khi gửi thông báo tự động:', error);
    }
}

// Hàm khởi động chính
async function main() {
    try {
        await connectDB();
        await dataCollector.initialize();

        // Khởi tạo Telegram bot
        console.log('🤖 Khởi động Telegram bot...');
        await sendAutoNotification('Bot đã được khởi động thành công!');

        // Bắt đầu gửi kèo
        await startBot();

        setInterval(async () => {
            try {
                const lotteryData = await dataCollector.getLotteryResults();
                await dataStorage.saveNumbers(lotteryData);
            } catch (error) {
                console.error('❌ Lỗi trong lúc lấy hoặc lưu dữ liệu:', error);
                await sendAutoNotification('❌ Có lỗi xảy ra khi cập nhật dữ liệu xổ số');
            }
        }, 3000);

        const browser = await launchBrowser();
        const page = await openBettingPage(browser);
        deleteServiceFloat(page);
        getCountDownTime(page, getAllLotteryNumbers, predictors.predict);

        process.on('SIGINT', async () => {
            console.log('🔄 Đang đóng ứng dụng...');
            await dataCollector.close();
            await sendAutoNotification('Bot đang tắt...');
            console.log('👋 Đã đóng tất cả kết nối. Thoát.');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Lỗi khởi tạo ứng dụng:', error.message);
        await sendAutoNotification('❌ Bot gặp lỗi khởi tạo: ' + error.message);
        process.exit(1);
    }
}

// Khởi động bot và các chức năng
console.log('🚀 Khởi động ứng dụng dự đoán kết quả xổ số...');
main();

// Export bot instance và hàm gửi thông báo
module.exports = {
    bot,
    sendAutoNotification
}; 