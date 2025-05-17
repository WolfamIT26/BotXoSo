const TelegramBot = require('node-telegram-bot-api');
const predictors = require('./predictors/index');
const { getAllLotteryNumbers } = require('./database/dataAccess');
const fs = require('fs');
const { sendAutoHistory } = require('./telegramBot');
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

// Xử lý tin nhắn
bot.on('message', (msg) => {
    console.log('📥 Nhận tin nhắn từ:', msg.chat.id, 'Nội dung:', msg.text);
    if (!msg.text.startsWith('/')) {
        bot.sendMessage(msg.chat.id, 'Vui lòng sử dụng các lệnh có sẵn. Gõ /help để xem danh sách lệnh.');
    }
});

let currentStart = null;
let currentEnd = null;
let currentStep = 1;
let currentType = null;
let runningInterval = null;
let lastCheckedDrawId = null;
let lastMessageId = null;

const LOG_PATH = './logs/keo_history.log';

const HUONG_DAN_MESSAGE =
    "📣 MIỀN BẮC VIP 45 GIÂY 🏆✨\n" +
    "🌟 KÈO Số Đầu ✨✨\n" +
    "🔸 Cách chơi:\n" +
    "👉 Số đầu của giải đặc biệt từ 0-4 là Xỉu\n" +
    "👉 Số đầu của giải đặc biệt từ 5-9 là Tài\n\n" +
    "🔸 Cách chia vốn:\n" +
    "Đánh theo tỷ lệ: 1-3-8-20-48-112-256\n\n" +
    "💰💰 Cách chơi 💰💰\n" +
    "Đánh theo kỳ hô (ví dụ 220-227) thì đánh theo bot hô, nếu thua thì đánh gấp thếp lên theo tỷ lệ (1-3-8-20-48-112-256) đến khi được húp thì đợi kỳ hô tiếp theo và quay về đánh x1.\n\n";

function ensureLogDirExists() {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function isDrawIdSaved(drawId) {
    try {
        const logContent = fs.readFileSync(LOG_PATH, 'utf8');
        return logContent.includes(`Đã lưu kỳ: ${drawId}`);
    } catch (e) {
        return false;
    }
}

// Xử lý lệnh /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (runningInterval) {
        bot.sendMessage(chatId, '⏳ Bot đang chạy rồi!');
        return;
    }
    bot.sendMessage(chatId, '🚦 Bắt đầu gửi kèo gấp thếp! ');

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

    await sendKeoAndHistory(chatId, 'Đợi');

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
                await sendKeoAndHistory(chatId, 'Húp 🎉');
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
                await sendKeoAndHistory(chatId, 'ĐỢI');
            } else {
                // THUA
                if (currentStep >= 7) {
                    // Gãy
                    await sendKeoAndHistory(chatId, 'Gãy 💥');
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
                    await sendKeoAndHistory(chatId, 'ĐỢI');
                } else {
                    // Tăng gấp thếp
                currentStep += 1;
                    await sendKeoAndHistory(chatId, 'ĐỢI');
                }
            }
        }

        console.log('Kỳ mới nhất trong DB:', nowDrawIdStr, 'Thời gian:', new Date().toLocaleTimeString());
        console.log('Cập nhật currentType:', currentType);
    }, 3000); // kiểm tra mỗi 3 giây
});

function formatHistoryMessage(historyMessages, lastLine) {
    return HUONG_DAN_MESSAGE + historyMessages.join('\n') + '\n' + lastLine;
}

async function sendKeoAndHistory(chatId, trangThai = 'ĐỢI') {
    const line = `${currentStart}-${currentEnd} gấp thếp ${currentStep} [${currentType}] ${trangThai}`;
    ensureLogDirExists();

    let logContent = '';
    let lines = [];
    try {
        logContent = fs.readFileSync(LOG_PATH, 'utf8');
        lines = logContent.split('\n').filter(line => line.trim() !== '');
    } catch (e) {}

    // Nếu trạng thái là ĐỢI, chỉ sửa dòng cuối cùng
    if (trangThai === 'ĐỢI' && lines.length > 0) {
        lines[lines.length - 1] = line;
        fs.writeFileSync(LOG_PATH, lines.join('\n') + '\n');
    } else if ((trangThai === 'Húp 🎉' || trangThai === 'Gãy 💥') && lines.length > 0) {
        // Nếu trạng thái là Húp hoặc Gãy, chỉ sửa dòng cuối nếu nó đang là ĐỢI
        if (lines[lines.length - 1].includes('ĐỢI')) {
            lines[lines.length - 1] = line;
            fs.writeFileSync(LOG_PATH, lines.join('\n') + '\n');
        } else {
            // Nếu không phải ĐỢI thì thêm dòng mới (trường hợp hiếm)
            fs.appendFileSync(LOG_PATH, line + '\n');
        }
    } else {
        // Trường hợp khởi tạo hoặc lạ, thêm dòng mới
        fs.appendFileSync(LOG_PATH, line + '\n');
    }

    // Đọc 8 dòng gần nhất
    const historyMessages = (lines.length > 0 ? lines : [line]).slice(-8);

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
        lastLine = '??? kỳ Số Phiên: ???=❓';
    }

    // Gộp thành 1 tin nhắn
    const message = formatHistoryMessage(historyMessages, lastLine);
    await bot.sendMessage(chatId, message);
}

// Xử lý lệnh /end
bot.onText(/\/end/, (msg) => {
    const chatId = msg.chat.id;
    if (runningInterval) {
        clearInterval(runningInterval);
        runningInterval = null;
        bot.sendMessage(chatId, '🛑 Đã dừng gửi kèo tự động!');
    } else {
        bot.sendMessage(chatId, 'Bot chưa chạy!');
    }
});

// Xử lý lệnh /help
bot.onText(/\/help/, (msg) => {
    console.log('📥 Nhận lệnh /help từ:', msg.chat.id);
    const chatId = msg.chat.id;
    const helpText = `
Các lệnh có sẵn:
/start - Bắt đầu sử dụng bot
/help - Hiển thị trợ giúp
/predict - Xem dự đoán số
/status - Kiểm tra trạng thái hệ thống
    `;
    bot.sendMessage(chatId, helpText);
});

// Xử lý lệnh /predict
bot.onText(/\/predict/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const historicalData = await getAllLotteryNumbers();
        const predictions = await predictors.predict(null, historicalData, 0, false);
        console.log('DEBUG predictions:', predictions);
        
        let predictionMessage = '🎲 Dự đoán số cho lần quay tiếp theo:\n\n';
        if (predictions && Array.isArray(predictions.numbers) && predictions.numbers.length > 0) {
            predictionMessage += `Số dự đoán: ${predictions.numbers.join(', ')}\n\n`;
        } else {
            predictionMessage += 'Không có dự đoán nào.\n\n';
        }
        predictionMessage += 'Lưu ý: Đây chỉ là dự đoán, không đảm bảo kết quả chính xác.';
        
        bot.sendMessage(chatId, predictionMessage);
    } catch (error) {
        console.error('Lỗi khi dự đoán:', error);
        bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi thực hiện dự đoán. Vui lòng thử lại sau.');
    }
});

// Xử lý lệnh /status
bot.onText(/\/status/, async (msg) => {
    console.log('📥 Nhận lệnh /status từ:', msg.chat.id);
    const chatId = msg.chat.id;
    try {
        // Kiểm tra kết nối database
        const dbStatus = '✅ Kết nối database: Hoạt động bình thường';
        
        // Kiểm tra dữ liệu mới nhất
        const latestData = await getAllLotteryNumbers();
        const lastUpdate = latestData.length > 0 && latestData[latestData.length - 1].timestamp
            ? new Date(latestData[latestData.length - 1].timestamp).toLocaleString()
            : 'Chưa có dữ liệu';
        
        // Tạo thông báo trạng thái
        const statusMessage = `
Trạng thái hệ thống:

${dbStatus}
📊 Dữ liệu mới nhất: ${lastUpdate}
📈 Số lượng bản ghi: ${latestData.length}
        `;
        
        bot.sendMessage(chatId, statusMessage);
    } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái:', error);
        bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi kiểm tra trạng thái hệ thống.');
    }
});

// Xử lý lệnh /result
bot.onText(/\/result/, async (msg) => {
    console.log('📥 Nhận lệnh /result từ:', msg.chat.id);
    const chatId = msg.chat.id;
    try {
        // Lấy dữ liệu gần nhất
        const historicalData = await getAllLotteryNumbers();
        if (!historicalData || historicalData.length === 0) {
            bot.sendMessage(chatId, '❌ Không có dữ liệu kết quả gần nhất.');
            return;
        }
        const latest = historicalData[0]; // hoặc historicalData[historicalData.length - 1] tùy thứ tự
        const resultMsg = `🎯 Kết quả xổ số gần nhất:\n\nSố: ${latest.numbers.join(', ')}\nThời gian: ${latest.timestamp ? new Date(latest.timestamp).toLocaleString() : 'Không rõ'}`;
        bot.sendMessage(chatId, resultMsg);
    } catch (error) {
        console.error('Lỗi khi lấy kết quả:', error);
        bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi lấy kết quả. Vui lòng thử lại sau.');
    }
});

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

// Xử lý lệnh /history
bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    const historicalData = await getAllLotteryNumbers();
    const currentDraw = historicalData && historicalData[0];
    const currentKy = currentDraw ? parseInt(currentDraw.drawId.toString().slice(-3), 10) : '???';
    const currentDrawId = currentDraw ? currentDraw.drawId : '???';

    const historyMessages = await getHistoryMessages();
    const lastLine = `${currentKy} kỳ Số Phiên: ${currentDrawId}=❓`;

    const message = formatHistoryMessage(historyMessages, lastLine);

    await bot.sendMessage(chatId, message);
});

async function getHistoryMessages() {
    // Đọc 8 dòng gần nhất từ file log thực tế
    let historyMessages = [];
    try {
        const logContent = fs.readFileSync(LOG_PATH, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim() !== '');
        historyMessages = lines.slice(-8);
    } catch (e) {
        historyMessages = ['Chưa có lịch sử gấp thếp!'];
    }
    return historyMessages;
}

// Khởi động bot
bot.startPolling({ polling: true });

// Export bot instance và hàm gửi thông báo
module.exports = {
    bot,
    sendAutoNotification
}; 