const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');

const website = 'https://www.dzrt.com/ar/our-products.html?product_list_limit=36';
const token = '7278217456:AAF4feWt6W7RStgYkeMmfl9-m-AzUmWT3XU';

const bot = new TelegramBot(token, { polling: true });

const imageUrlMap = {
  'هيلة': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/8/0/80547bbecf108b8180547bbecf108b81haila__2810mg_29-view3_2_11zon_1.png',
  'سمرة': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/s/a/samra__10mg_-view3_2_11zon_1.png',
  'تمرة': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/t/a/tamra__6mg_-view3_1_11zon_1.png',
  'إيدجي منت': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/e/d/edgy_mint_6mg_vue03.png',
  'ايسي رش': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/i/c/icy_rush_10mg_vue03_1.png',
  'منت فيوجن': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/m/i/mint_fusion_6mg_vue03_2.png',
  'جاردن منت': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/g/a/garden_mint_6mg_vue03_1.png',
  'سي سايد فروست': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/s/e/seaside_frost_10mg_vue03_1.png',
  'هايلاند بيريز': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/h/i/highland_berries_6mg_vue03_1.png',
  'بيربل مست': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/p/u/purple_mist_3mg_vue03-20230707.png',
  'سبايسي زيست': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/s/p/spicy_zest_3mg_vue03_1.png',
};

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


bot.onText(/\/fakeNotification(?: (.+))?/, (msg, match) => {
  const userId = msg.from.id; 
  const chatId = msg.chat.id; 
  const targetUserId = 893875350;

  if (userId !== targetUserId) {
    bot.sendMessage(chatId, 'غير مصرح لك باستخدام هذا الرمز');
    return;
  }

  const productName = match[1];

  if (productName && channelThreadMap.hasOwnProperty(productName)) {
    const threadId = channelThreadMap[productName];
    const imageUrl = imageUrlMap[productName];
    const description = `جرب الطعم الحقيقي لأصالة البيت العربي و الضيافة و التراث مع مزيج سعودي مميز للقهوة السعودية و الهيل`;
    const message = `
*اسم المنتج:* [${productName}](https://www.dzrt.com/ar/haila.html) \n
*الوصف:* ${description} \n 
*الحالة:* *متوفر* \n
`;

    const opts = {
      parse_mode: 'MarkdownV2',
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            { text: 'شراء الآن', url: 'https://www.dzrt.com/ar/' },
            { text: 'السلة 🛒', url: 'https://www.dzrt.com/ar/checkout/cart/' }
          ],
          [
            { text: 'طلباتي 📝', url: 'https://www.dzrt.com/ar/sales/order/history/' }
          ]
        ]
      }),
      message_thread_id: parseInt(threadId.split('_')[1], 10) 
    };

    bot.sendMessage(parseInt(threadId.split('_')[0], 10), message, opts) 
      .then(() => {
        console.log(`تم إرسال إشعار وهمي إلى القناة ${threadId} للمنتج ${productName}`);
      })
      .catch((error) => {
        console.error(`خطأ في إرسال الإشعار الوهمي إلى القناة ${threadId} للمنتج ${productName}:`, error);
      });

  } else {
    console.log('اسم المنتج غير صالح أو لا توجد قناة مطابقة.');
  }
});


async function sendNotifications() {
  try {
    const response = await axios.get(website);
    const $ = cheerio.load(response.data);
    const products = $('li.item.product.product-item');

    products.each(async (i, product) => {
      const name = $(product).find('strong.product.name').text().trim();
      const availability = $(product).hasClass('unavailable') ? 'غير متوفر' : 'متوفر';
      const link = $(product).find('a.product-item-link').attr('href');
      const description = $(product).find('.product.attribute.overview .value[itemprop="description"]').text().trim();

      if (availability === 'متوفر' && (!sentProducts.has(name) || sentProducts.get(name) !== availability)) {
        const message = `
*اسم المنتج:* [${name}](${link}) \n
*الوصف:* ${description} \n
*الحالة:* *${availability}* \n
`;
        const opts = {
          parse_mode: 'MarkdownV2',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: 'شراء الآن', url: link },
                { text: 'السلة 🛒', url: 'https://www.dzrt.com/ar/checkout/cart/' }
              ],
              [
                { text: 'طلباتي 📝', url: 'https://www.dzrt.com/ar/sales/order/history/' }
              ]
            ]
          }),
          message_thread_id: parseInt(channelThreadMap[name].split('_')[1], 10)
        };

        const channelId = parseInt(channelThreadMap[name].split('_')[0], 10); 
        if (channelId) {
          await bot.sendMessage(channelId, message, opts);
          console.log(`تم إرسال إشعار للقناة ${channelId} بالمنتج ${name}`);
          sentProducts.set(name, availability); 
        }
      } else if (availability === 'غير متوفر' && sentProducts.has(name)) {
         sentProducts.delete(name);
      }
    });
  } catch (error) {
    console.error('خطأ في جلب البيانات:', error);
  } finally {
    setTimeout(sendNotifications, 2800);  
  }
}

sendNotifications();



bot.on('polling_error', (error) => {
  console.error(`خطأ في الاستطلاع: ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`خطأ في البوت: ${error.message}`);
});

