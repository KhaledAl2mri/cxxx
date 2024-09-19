const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');

const website = 'https://www.dzrt.com/ar-sa/category/nicotine-pouches';
const token = '7278217456:AAF4feWt6W7RStgYkeMmfl9-m-AzUmWT3XU';

const bot = new TelegramBot(token, { polling: true });


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


const sentProducts = new Map();


async function sendNotifications() {
  try {
    const response = await axios.get(website);
    const $ = cheerio.load(response.data);

    // Select the correct product containers
    const products = $('.grid.grid-cols-2.gap-3.lg\\:grid-cols-5.lg\\:gap-6 > div.relative.bg-white');

    products.each(async (i, product) => {
      const name = $(product).find('span[title]').text().trim();
      const availabilitySpan = $(product).find('.bg-custom-orange-700');
      const isAvailable = availabilitySpan.length === 0 && !$(product).find('button[disabled]').length; // Check for availability
      const link = $(product).find('a').attr('href');
      const description = $(product).find('span.line-clamp-2').text().trim();

      // Print product availability to console for debugging
      console.log(`اسم المنتج: ${name}, متوفر: ${isAvailable}`);

      if (isAvailable && (!sentProducts.has(name) || sentProducts.get(name) !== 'متوفر')) {
        const message = `
*اسم المنتج:* [${name}](https://www.dzrt.com${link}) \n
*الوصف:* ${description} \n
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
          message_thread_id: parseInt(channelThreadMap[name].split('_')[1], 10)
        };

        const channelId = parseInt(channelThreadMap[name].split('_')[0], 10);
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
    setTimeout(sendNotifications, 2800);
  }
}


bot.onText(/\/wc (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const productName = match[1].trim();

  try {
    const response = await axios.get(website);
    const $ = cheerio.load(response.data);
    const products = $('.grid.grid-cols-2.gap-3.lg\\:grid-cols-5.lg\\:gap-6 > div.relative.bg-white');

    let productFound = false;
    let isAvailable = false;

    products.each((i, product) => {
      const name = $(product).find('span[title]').first().text().trim(); // Get product name
      const addToCartButton = $(product).find('button[disabled]'); // Find the "Add to Cart" button with disabled attribute

      console.log(`Product Name: ${name}`); // Log the product name to the console

      // Check availability based on the button's disabled state
      const buttonDisabled = addToCartButton.attr('disabled');
      isAvailable = buttonDisabled === undefined; // If button is not disabled, the product is available
      
      console.log(`Button Disabled: ${buttonDisabled}`); // Log the button's disabled state
      console.log(`Available: ${isAvailable}`); // Log the availability status

      if (name === productName) {
        productFound = true;
        // Check availability again to ensure it matches
        isAvailable = buttonDisabled === undefined; // Update availability status if product is found
      }
    });

    if (productFound) {
      const message = isAvailable 
        ? `المنتج *${productName}* متوفر الآن` 
        : `المنتج *${productName}* غير متوفر`;
      await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    } else {
      await bot.sendMessage(chatId, 'عذراً، المنتج المطلوب غير موجود.');
    }
  } catch (error) {
    console.error('خطأ في جلب البيانات:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء محاولة جلب البيانات.');
  }
});

sendNotifications();

bot.on('polling_error', (error) => {
  console.error(`خطأ في الاستطلاع: ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`خطأ في البوت: ${error.message}`);
});
