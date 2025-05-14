const puppeteer = require('puppeteer-core');

// Các hằng số cấu hình
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BETTING_URL = 'https://bet.6nluck8.cc/home/?inviteCode=4592386#/lottery?tabName=Lottery&id=47';

const SELECTORS = {
  guest: '.navigationBoxBottom > button:nth-child(4)',
  numberOption: '.plays li:nth-child(2)',
  taiOption: '.ballBox > li:first-child p:first-of-type',
  xiuOption: '.ballBox > li:nth-child(2) p:first-of-type',
  submitButton: '.btn-group-wp > button',
  betInput: '.lottery-input input',
  usernameInput: '#navigationBarMaxWidthNav > div.nav-top > div.navTopContainer > div.navigationBox > div.navigationBoxBottom > div > form > div:nth-child(1) > div > div > input',
  passwordInput: '#navigationBarMaxWidthNav > div.nav-top > div.navTopContainer > div.navigationBox > div.navigationBoxBottom > div > form > div:nth-child(2) > div > div > input',
  loginButton: '.loginWrapper > button',
  hoverLogout: '.accountInfoWrapper',
  logoutButton: 'ul.el-menu.el-menu--popup.el-menu--popup-bottom-start > li:last-child > span',
  money: '.total_money',
  winningNotice: '.winning-notice-wp .title-wp .iconfont.icon-icon_close_white',
  closeNoticeBet: '.result-title > span',
  failureLogin: '.el-message.el-message--error.el-message-fade-enter-active.el-message-fade-enter-to',
  secondLastDigit: '._timeDown .vue-count-time .time span:nth-last-child(2)',
  lastDigit: '._timeDown .vue-count-time .time span:last-child',
};

async function deleteServiceFloat(page) {
  try {
    const isRemoved = await page.evaluate(() => {
      const element = document.querySelector('#serviceFloat');
      if (element) {
        element.remove();
        return true;
      }
      return false;
    });
    console.log(isRemoved ? "✅ Đã xóa element thành công" : "⚠️ Không tìm thấy element");
  } catch (error) {
    console.error(`❌ Lỗi: ${error.message}`);
  }
}

async function login(page, username, password) {
  await page.click(SELECTORS.usernameInput);
  await page.keyboard.type(username);

  await page.click(SELECTORS.passwordInput);
  await page.keyboard.type(password);

  await page.click(SELECTORS.loginButton);
  await delay(500);

  const failureLogin = await page.$(SELECTORS.failureLogin);
  if (failureLogin) {
    await page.click(SELECTORS.usernameInput);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    await page.click(SELECTORS.passwordInput);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    console.log("❌ Đăng nhập thất bại - đã xóa các ô input để chuẩn bị thử lại");
    return false;
  } else {
    await delay(500);
    await page.mouse.click(20, 20);
    return true;
  }
}

async function logout(page) {
  await page.mouse.click(20, 20);
  await page.hover(SELECTORS.hoverLogout);
  await delay(600);
  await page.click(SELECTORS.logoutButton);
}

/**
 * Khởi chạy trình duyệt với cấu hình tối ưu
 * @returns {Promise<Browser>} Instance trình duyệt
 */
async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: null,
    protocolTimeout: 120000,
    timeout: 30000,
    args: [
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-features=Translate,TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-first-run',
      '--password-store=basic',
      '--use-mock-keychain',
      '--no-sandbox',
      '--disable-gpu',        // Giữ lại để tắt GPU acceleration
      '--mute-audio',         // Giữ lại để tắt âm thanh
    ]
  });
}

/**
 * Giải phóng bộ nhớ trong page
 * @param {Page} page Trang web hiện tại
 */
async function clearPageMemory(page) {
  if (page && !page.isClosed()) {
    await page.evaluate(() => {
      if (window.gc) window.gc();
    }).catch(() => { });
  }
}

/**
 * Mở trang cá cược
 * @param {Browser} browser Instance trình duyệt
 * @returns {Promise<Page>} Trang web đã mở
 */
async function openBettingPage(browser) {
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);
  await page.setCacheEnabled(false);

  try {
    await page.goto(BETTING_URL, {
      waitUntil: 'networkidle2', // Thay đổi lại để đảm bảo trang tải đầy đủ
      timeout: 60000,
    });
  } catch (error) {
    console.error("Lỗi khi mở trang betting:", error.message);
    // Thử lại với waitUntil khác nếu lỗi
    try {
      await page.goto(BETTING_URL, {
        waitUntil: 'load',
        timeout: 60000,
      });
    } catch (secondError) {
      console.error("Lỗi khi thử mở trang lần 2:", secondError.message);
    }
  }

  return page;
}

/** 
 * Di chuyển đến phần xổ số
 * @param {Page} page Trang web hiện tại
 */
async function loginAsGuest(page) {
  await page.click(SELECTORS.guest);
  await delay(700);
  await page.mouse.click(20, 20);
  await delay(300);
  return true;
}

/**
 * Lấy số dư tài khoản từ trang web 
 * @param {Page} page Trang web hiện tại
 * @returns {Promise<number|null>} Số dư tài khoản hoặc null nếu không lấy được
 */
async function getMoney(page) {
  try {
    const moneyElement = await page.$(SELECTORS.money);
    if (!moneyElement) {
      return null;
    }

    const accountBalance = await moneyElement.evaluate(e => e.textContent);
    if (!accountBalance) {
      return null;
    }

    const cleanedBalance = accountBalance.toString().replace(/[^\d]/g, '');
    if (!cleanedBalance) {
      return null;
    }

    const convertedBalance = parseInt(cleanedBalance);
    return convertedBalance;
  } catch (error) {
    console.error(`❌ Lỗi khi lấy số dư: ${error.message}`);
    return null;
  }
}

/**
 * Chọn tùy chọn cá cược
 * @param {Page} page Trang web hiện tại
 * @param {string} option Tùy chọn ('tai' hoặc 'xiu')
 */
async function selectBettingOptions(page, option = 'xiu') {
  if (option === 'tai') {
    await page.click(SELECTORS.taiOption);
  } else {
    await page.click(SELECTORS.xiuOption);
  }
}

/**
 * Chọn loại cược số
 * @param {Page} page Trang web hiện tại
 */
async function selectNumber(page) {
  await page.click(SELECTORS.numberOption);
}

/**
 * Đặt cược với số tiền xác định
 * @param {Page} page Trang web hiện tại
 * @param {number} amount Số tiền cược
 */
async function placeBet(page, amount) {
  const success = await enterBetAmount(page, amount);
  if (!success) {
    console.log("Không thể nhập số tiền cược");
    return false;
  }

  try {
    await page.click(SELECTORS.submitButton);
    await delay(700);
    try {
      const closeBtn = await page.$(SELECTORS.closeNoticeBet);

      if (closeBtn) {
        await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) element.click();
        }, SELECTORS.closeNoticeBet);
      } else {
        console.log('⚠️ Không tìm thấy nút đóng thông báo');
        await checkAndClickWinningNotice(page);
      }
    } catch (error) {
      console.error(`❌ Lỗi khi đóng thông báo: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Lỗi khi đặt cược:', error);
    return false;
  }
}

/**
 * Nhập giá trị số tiền vào ô input với xử lý lỗi cải tiến
 * @param {Page} page Trang web hiện tại
 * @param {number} amount Số tiền cược
 * @returns {Promise<boolean>} Kết quả thao tác
 */
async function enterBetAmount(page, amount) {
  const maxRetries = 3;
  let success = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Thử nhập giá trị lần ${attempt}/${maxRetries}...`);

    try {
      success = await page.evaluate((value, selector) => {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          const parentElement = input.parentElement;
          const span = parentElement.querySelector('span');
          if (span && span.textContent.includes('1 x')) {
            input.focus();
            input.value = '';
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, amount.toString(), SELECTORS.betInput);

      if (success) {
        console.log(`✅ Đã nhập giá trị ${amount} vào input thành công`);
        return true;
      }

      console.log(`⚠️ Không tìm thấy input phù hợp (lần ${attempt}/${maxRetries})`);

    } catch (error) {
      console.error(`❌ Lỗi khi nhập giá trị (lần ${attempt}/${maxRetries}):`, error);
    }

    // Nếu chưa thành công và còn lượt thử, delay 1s trước khi thử lại
    if (!success && attempt < maxRetries) {
      console.log(`⏳ Delay 1s trước khi thử lại...`);
      await delay(1000);
    }
  }

  console.error('❌ Không thể nhập giá trị sau nhiều lần thử');
  return false;
}

/**
 * Tạm dừng thực thi trong một khoảng thời gian
 * @param {number} ms Thời gian tạm dừng tính bằng millisecond
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Kiểm tra và click vào thông báo thắng cược nếu có
 * @param {Page} page Trang web hiện tại
 * @returns {Promise<boolean>} true nếu đã click, false nếu không có gì để click
 */
async function checkAndClickWinningNotice(page) {
  try {
    await delay(1000);

    // Kiểm tra xem thông báo chiến thắng có tồn tại không
    const elementExists = await page.evaluate(() => {
      const notice = document.querySelector('.winning-notice-wp');
      return notice !== null;
    });

    if (elementExists) {
      console.log("🏆 Đã phát hiện thông báo chiến thắng, đang đóng...");

      // Tìm và click vào nút đóng trong thông báo
      const closeButtonClicked = await page.evaluate(() => {
        const closeButton = document.querySelector('.winning-notice-wp .title-wp .iconfont.icon-icon_close_white');
        if (closeButton) {
          closeButton.click();
          return true;
        }
        return false;
      });

      if (closeButtonClicked) {
        console.log("✅ Đã đóng thông báo chiến thắng thành công");
        return true;
      } else {
        console.log("⚠️ Không tìm thấy nút đóng trong thông báo chiến thắng");
      }
    }

    return false;
  } catch (e) {
    console.error("❌ Lỗi khi xử lý thông báo chiến thắng:", e.message);
    return false;
  }
}

function getCountDownTime(page, getAllLotteryNumbers, predict) {
  console.log("✅ Bắt đầu theo dõi countdown...");

  let isPredicting = false;
  let hasPredicted = false;
  let hasClickedWinningNotice = false;
  let lastSeconds = -1;

  const intervalId = setInterval(async () => {
    if (page.isClosed()) {
      clearInterval(intervalId);
      return;
    }

    try {
      const timeElements = await Promise.all([
        page.$eval(SELECTORS.secondLastDigit, el => el.textContent),
        page.$eval(SELECTORS.lastDigit, el => el.textContent)
      ]);

      const seconds = parseInt(timeElements[0] + timeElements[1]);

      if (seconds !== lastSeconds) {
        console.log("⏳ Số giây còn lại:", seconds);
        lastSeconds = seconds;
      }

      if (lastSeconds === 0 && seconds > 30) {
        console.log("🔄 Bắt đầu kỳ mới!");
        hasPredicted = false;
        hasClickedWinningNotice = false;
      }

      if (seconds > 30 && seconds < 36) {
        if (!hasClickedWinningNotice) {
          const clicked = await checkAndClickWinningNotice(page);
          hasClickedWinningNotice = true;
          if (clicked) {
            console.log("🏆 Đã xử lý thông báo chiến thắng trong kỳ này");
          }
        }
      }

      if (seconds >= 15 && seconds <= 28 && !isPredicting && !hasPredicted) {
        console.log("🎯 Đếm ngược phù hợp, bắt đầu gọi dự đoán...");

        isPredicting = true;
        hasPredicted = true;

        try {
          const history = await getAllLotteryNumbers();
          const prediction = await predict(page, history, 0, true);
          console.log("📈 Kết quả dự đoán:", prediction);
        } catch (error) {
          console.error("❌ Lỗi khi dự đoán:", error.message);
        } finally {
          isPredicting = false;
        }
      }

      if (seconds <= 1) {
        hasPredicted = false;
      }

    } catch (error) {
      console.error("⚠️ Lỗi khi đọc countdown:", error.message);
    }
  }, 1000);

  return intervalId;
}

module.exports = {
  launchBrowser,
  openBettingPage,
  loginAsGuest,
  selectNumber,
  selectBettingOptions,
  placeBet,
  enterBetAmount,
  delay,
  login,
  logout,
  getMoney,
  clearPageMemory,
  getCountDownTime,
  deleteServiceFloat
};