const connectDB = require('./config/database');
const dataCollector = require('./collectors/dataCollector');
const dataStorage = require('./database/dataStorage');
const predictors = require('./predictors/index');
const { getAllLotteryNumbers } = require('./database/dataAccess');
const { openBettingPage, launchBrowser, getCountDownTime, deleteServiceFloat } = require('./betAutomatic');
const { bot, sendAutoNotification } = require('./telegramBot');

async function main() {
  try {
    await connectDB();
    await dataCollector.initialize();

    // Khởi tạo Telegram bot
    console.log('🤖 Khởi động Telegram bot...');
    await sendAutoNotification('Bot đã được khởi động thành công!');

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
    deleteServiceFloat(page)
    getCountDownTime(page, getAllLotteryNumbers, predictors.predict)

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

console.log('🚀 Khởi động ứng dụng dự đoán kết quả xổ số...');
main();