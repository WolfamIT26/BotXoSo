const Lottery = require('./models/lotteryModel'); // Sửa đường dẫn

async function saveNumbers(lotteryData) {
    // Đảo ngược để xử lý từ kết quả cũ đến mới nhất
    lotteryData.reverse();

    for (const item of lotteryData) {
        try {
            // Kiểm tra sự tồn tại dựa trên drawId
            const exists = await Lottery.findOne({ drawId: item.drawId });

            if (!exists) {
                // Tạo bản ghi mới với đầy đủ thông tin
                const lotteryRecord = new Lottery({
                    drawId: item.drawId,
                    numbers: item.numbers,
                    drawTime: item.drawTime
                });
                await lotteryRecord.save();
                console.log('Đã lưu kỳ:', item.drawId);
            } 

            // Giới hạn số lượng bản ghi
            const count = await Lottery.countDocuments();
            if (count > 250) {
                // Sử dụng createdAt thay vì timestamp
                const oldestRecord = await Lottery.findOne().sort({ createdAt: 1 });
                if (oldestRecord) {
                    await Lottery.deleteOne({ _id: oldestRecord._id });
                    console.log('Đã xóa bản ghi cũ nhất:', oldestRecord.drawId);
                } else {
                    console.log('Không tìm thấy bản ghi cũ nhất để xóa.');
                }
            }
        } catch (err) {
            console.error('Lỗi khi lưu vào DB:', err);
        }
    }
}

// Lấy tất cả bản ghi
async function getAllNumbers() {
    return await Lottery.find().sort({ createdAt: -1 });
}

// Lấy n bản ghi mới nhất
async function getLatestNumbers(limit = 10) {
    return await Lottery.find().sort({ createdAt: -1 }).limit(limit);
}

module.exports = {
    saveNumbers,
    getAllNumbers,
    getLatestNumbers
};