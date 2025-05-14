const Lottery = require('./models/lotteryModel');

async function getDataFromDB() {
    try {
        const records = await Lottery.find().sort({ createdAt: -1 });
        return records;
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu:', error);
        return [];
    }
}

module.exports = {
    getAllLotteryNumbers: getDataFromDB,
};