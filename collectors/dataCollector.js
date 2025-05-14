const puppeteer = require('puppeteer-core');

// Biến lưu trữ trạng thái
let browser = null;
let page = null;

// Khởi tạo scraper
async function initialize() {
  browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  page = await browser.newPage();
  await page.goto('https://1.bot/Lottery/MienBacVIP45', { waitUntil: 'networkidle2' });

  await autoScroll(page);

  console.log('Scraper đã được khởi tạo');
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function getLotteryResults() {
  if (!page) {
    throw new Error('Scraper chưa được khởi tạo');
  }

  try {
    await page.waitForSelector('#tableHistory tr:last-child .number', { timeout: 5000 });

    const tableData = await page.$$eval('#tableHistory tr:not(:first-child)', rows => {
      return rows.map(row => {
        const columns = row.querySelectorAll('td');
        if (columns.length >= 3) {
          const drawId = columns[0].textContent.trim();
          
          const numberCell = columns[1];
          const spans = numberCell.querySelectorAll('span.opencode');
          const numbers = Array.from(spans).map(span => span.textContent.trim());
          
          const drawTime = columns[2].textContent.trim();
          
          return {
            drawId: drawId,
            numbers: numbers,
            drawTime: drawTime
          };
        }
        return null;
      });
    });
    return tableData;
  } catch (error) {
    console.error('Lỗi khi lấy số:', error);
    throw error;
  }
}

module.exports = {
  initialize,
  getLotteryResults,
};
