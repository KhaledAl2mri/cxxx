const axios = require('axios');
const cheerio = require('cheerio');
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
  try {
    const response = await axios.get(website);
    const $ = cheerio.load(response.data);

    // Select the product containers
    const products = $('.grid.grid-cols-2.gap-3.lg\\:grid-cols-5.lg\\:gap-6 > div.relative.bg-white');

    // Iterate over each product
    products.each(async (i, product) => {
      // Get product name
      let name = $(product).find('a > div.flex.flex-col.pb-2\\.5.pt-4\\.5 > span:nth-child(1)').text().trim();

      // Handle special product name case
      if (name === 'سمرة إصدار خاص') {
        name = 'سمرة';
      }

      // Check if the product name is in the channelThreadMap
      if (!channelThreadMap[name]) {
        console.warn(`No channel mapping found for product: ${name}`);
        return; // Skip to the next product
      }

      // Continue with processing only if the name exists in the channelThreadMap
      const messageThreadId = parseInt(channelThreadMap[name].split('_')[1], 10);
      const channelId = parseInt(channelThreadMap[name].split('_')[0], 10);

      // Check product availability
      const availabilitySpan = $(product).find('.bg-custom-orange-700');
      const isAvailable = availabilitySpan.length === 0 && !$(product).find('button[disabled]').length;
      const link = $(product).find('a').attr('href');

      // Proceed if the product is available and hasn't been notified yet
      if (isAvailable && (!sentProducts.has(name) || sentProducts.get(name) !== 'متوفر')) {
        const message = `
*اسم المنتج:* [${name.replace(/\./g, '\\.')}](${`https://www.dzrt.com${link}`}) \n
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
          message_thread_id: messageThreadId
        };

        if (channelId) {
          await bot.sendMessage(channelId, message, opts);
          console.log(`تم إرسال إشعار للقناة ${channelId} بالمنتج ${name}`);
          sentProducts.set(name, 'متوفر');
        }
      } else if (!isAvailable && sentProducts.has(name)) {
        sentProducts.set(name, 'غير متوفر');
      } else if (sentProducts.has(name) && !isAvailable) {
        sentProducts.delete(name);
      }
    });
  } catch (error) {
    console.error('خطأ في جلب البيانات:', error);
  } finally {
    setTimeout(sendNotifications, 2800); // Re-run the function after 2.8 seconds
  }
}

// Command to check product availability via Telegram bot
bot.onText(/\/wc (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const productName = match[1].trim();

  try {
    const response = await axios.get(website);
    const $ = cheerio.load(response.data);
    const products = $('.grid.grid-cols-2.gap-3.lg\\:grid-cols-5.lg\\:gap-6 > div.relative.bg-white');

    let productFound = false;
    let isAvailable = false;

    // Check each product
    products.each((i, product) => {
      let name = $(product).find('span[title]').first().text().trim(); // Get product name
      const addToCartButton = $(product).find('button[disabled]'); // Find "Add to Cart" button

      // Handle special case for "Samra Special Edition"
      if (name === 'Samra Special Edition') {
        name = 'سمرة';
      }

      // Check if the product is available
      const buttonDisabled = addToCartButton.attr('disabled');
      isAvailable = buttonDisabled === undefined;

      if (name === productName) {
        productFound = true;
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
