const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot Token
const website = 'https://www.dzrt.com/ar-sa/category/nicotine-pouches';
const token = '7278217456:AAF4feWt6W7RStgYkeMmfl9-m-AzUmWT3XU';
const bot = new TelegramBot(token, { polling: true });

// Channel mapping for products
const channelThreadMap = {
  'ايسي رش': '-1002179587442_4',
  'سي سايد فروست': '-1002179587442_5',
  'هيلة': '-1002179587442_14',
  'سبايسي زيست': '-1002179587442_13',
  'إيدجي منت': '-1002179587442_12',
  'جاردن منت': '-1002179587442_11',
  'هايلاند بيريز': '-1002179587442_10',
  'منت فيوجن': '-1002179587442_9',
  'سمرة': '-1002179587442_8',
  'بيربل مست': '-1002179587442_7',
  'تمرة': '-1002179587442_6'
};

// Keep track of sent products
const sentProducts = new Map();

// Function to send notifications
async function sendNotifications() {
  const browser = await puppeteer.launch({ headless: true }); // Headless mode
  const page = await browser.newPage();

  try {
    // Navigate to the specified URL
    await page.goto(website, { waitUntil: 'networkidle2' });

    // Use page.evaluate to run code in the context of the page
    const products = await page.evaluate(() => {
      const items = [];
      const productContainers = document.querySelectorAll('.grid.grid-cols-2.gap-3.lg\\:grid-cols-5.lg\\:gap-6 > div.relative.bg-white');
      productContainers.forEach(product => {
        const name = product.querySelector('a > div.flex.flex-col.pb-2\\.5.pt-4\\.5 > span:nth-child(1)')?.textContent.trim();
        const link = product.querySelector('a')?.getAttribute('href');
        const availabilitySpan = product.querySelector('.bg-custom-orange-700');
        const isAvailable = availabilitySpan === null && !product.querySelector('button[disabled]');
        
        items.push({ name, link, isAvailable });
      });
      return items;
    });

    // Iterate over each product fetched
    for (const product of products) {
      let { name, link, isAvailable } = product;

      // Escape special characters for Telegram Markdown
      const escapedName = name.replace(/\./g, '\\.');

      // Proceed if the product is available and hasn't been notified yet
      if (isAvailable && (!sentProducts.has(name) || sentProducts.get(name) !== 'متوفر')) {
        const channelThread = channelThreadMap[name];

        // Check if the channelThread exists before proceeding
        if (channelThread) {
          const message = `
*اسم المنتج:* [${escapedName}](https://www.dzrt.com${link}) \n
*الحالة:* *متوفر* \n
          `;

          const opts = {
            parse_mode: 'MarkdownV2',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: 'شراء الآن', url: `https://www.dzrt.com${link}` },
                  { text: 'السلة 🛒', url: 'https://www.dzrt.com/ar-sa/cart' }
                ],
                [
                  { text: 'طلباتي 📝', url: 'https://www.dzrt.com/ar-sa/sales/order/history/' }
                ]
              ]
            }),
            message_thread_id: parseInt(channelThread.split('_')[1], 10)
          };

          const channelId = parseInt(channelThread.split('_')[0], 10);
          if (channelId) {
            await bot.sendMessage(channelId, message, opts);
            console.log(`تم إرسال إشعار للقناة ${channelId} بالمنتج ${name}`);
            sentProducts.set(name, 'متوفر');
          }
        } else {
          console.warn(`القناة غير موجودة للمنتج: ${name}`);
        }
      } else if (!isAvailable && sentProducts.has(name)) {
        sentProducts.set(name, 'غير متوفر');
      } else if (sentProducts.has(name) && !isAvailable) {
        sentProducts.delete(name);
      }
    }
  } catch (error) {
    console.error('خطأ في جلب البيانات:', error);
  } finally {
    await browser.close(); // Close the browser after fetching
    setTimeout(sendNotifications, 2800); // Re-run the function after 2.8 seconds
  }
}

// Command to check product availability via Telegram bot
bot.onText(/\/wc (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const productName = match[1].trim();

  const browser = await puppeteer.launch({ headless: true }); // Headless mode for the command
  const page = await browser.newPage();

  try {
    await page.goto(website, { waitUntil: 'networkidle2' });
    const products = await page.evaluate(() => {
      const items = [];
      const productContainers = document.querySelectorAll('.grid.grid-cols-2.gap-3.lg\\:grid-cols-5.lg\\:gap-6 > div.relative.bg-white');
      productContainers.forEach(product => {
        const name = product.querySelector('span[title]')?.textContent.trim();
        const addToCartButton = product.querySelector('button[disabled]');
        const isAvailable = addToCartButton === null;
        
        items.push({ name, isAvailable });
      });
      return items;
    });

    let productFound = false;
    let isAvailable = false;

    products.forEach(product => {
      if (product.name === productName) {
        productFound = true;
        isAvailable = product.isAvailable;
      }
    });

    // Send product availability message
    if (productFound) {
      const message = isAvailable 
        ? `المنتج *${productName}* متوفر الآن` 
        : `المنتج *${productName}* غير متوفر`;
      await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    } else {
      await bot.sendMessage(chatId, 'عذراً، المنتج المطلوب غير موجود');
    }
  } catch (error) {
    console.error('خطأ في جلب البيانات:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء محاولة جلب البيانات');
  } finally {
    await browser.close(); // Close the browser
  }
});

// Send notifications initially
sendNotifications();

// Handle polling and bot errors
bot.on('polling_error', (error) => {
  console.error(`خطأ في الاستطلاع: ${error.message}`);
});
bot.on('error', (error) => {
  console.error(`خطأ في البوت: ${error.message}`);
});
