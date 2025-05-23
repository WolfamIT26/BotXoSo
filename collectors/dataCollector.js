const puppeteer = require('puppeteer-core');

// Biến lưu trữ trạng thái
let browser = null;
let page = null;

// Khởi tạo scraper
async function initialize() {
  try {
    const chromePath = (() => {
      const platform = process.platform;
      if (platform === 'win32') {
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      } else if (platform === 'linux') {
        return '/usr/bin/google-chrome';
      } else if (platform === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      } else {
        console.warn(`Platform ${platform} not explicitly supported, defaulting to Linux path`);
        return '/usr/bin/google-chrome';
      }
    })();
    
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      defaultViewport: null,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    page = await browser.newPage();
    
    // Set timeout dài hơn
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);

    // Thêm user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Bỏ qua các resource không cần thiết
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Xử lý lỗi navigation
    page.on('error', err => {
      console.error('Lỗi page:', err);
    });

    page.on('pageerror', err => {
      console.error('Lỗi JavaScript:', err);
    });

    console.log('Đang truy cập trang web...');
    await page.goto('https://1.bot/Lottery/MienBacVIP45', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Đợi cho bảng load xong
    await page.waitForSelector('#tableHistory', { timeout: 30000 });
    console.log('Đã load bảng thành công');

    await autoScroll(page);
    console.log('Scraper đã được khởi tạo thành công');
  } catch (error) {
    console.error('Lỗi khởi tạo scraper:', error);
    throw error;
  }
}

async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  } catch (error) {
    console.error('Lỗi khi scroll:', error);
  }
}

async function getLotteryResults() {
  if (!page) {
    throw new Error('Scraper chưa được khởi tạo');
  }

  let retries = 3;
  while (retries > 0) {
    try {
      // Refresh trang nếu cần
      if (retries < 3) {
        console.log(`Thử lại lần ${4-retries}...`);
        await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForSelector('#tableHistory', { timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Đợi thêm 2s sau khi reload
      }

      // Đợi và lấy dữ liệu
      await page.waitForSelector('#tableHistory tr:last-child', { timeout: 30000 });
      
      // Đợi thêm một chút để đảm bảo DOM đã ổn định
      await new Promise(resolve => setTimeout(resolve, 1000));

      const tableData = await page.evaluate(() => {
        const rows = document.querySelectorAll('#tableHistory tr:not(:first-child)');
        return Array.from(rows).map(row => {
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
        }).filter(item => item !== null);
      });

      if (tableData && tableData.length > 0) {
        return tableData;
      }

      throw new Error('Không tìm thấy dữ liệu hợp lệ');
    } catch (error) {
      console.error(`Lỗi lần ${4-retries}:`, error.message);
      retries--;
      
      if (retries === 0) {
        throw new Error('Không thể lấy dữ liệu sau nhiều lần thử');
      }
      
      // Đợi 2 giây trước khi thử lại
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Hàm đóng browser
async function close() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

module.exports = {
  initialize,
  getLotteryResults,
  close
};
