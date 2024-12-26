const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
let { channelThreadMap } = require('./channelConfig');

// Telegram Bot Token
const website = 'https://www.dzrt.com/ar-sa/category/nicotine-pouches';
const token = '7278217456:AAF4feWt6W7RStgYkeMmfl9-m-AzUmWT3XU';
const bot = new TelegramBot(token, { polling: true });

// Keep track of sent products
const sentProducts = new Map();

// Store user states
const userStates = new Map();

// Admin chat ID
const ADMIN_CHAT_ID = 893875350;

// Create topic using raw API call
async function createForumTopic(chatId, name) {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${token}/createForumTopic`, {
      chat_id: chatId,
      name: name
    });
    
    if (response.data.ok) {
      return response.data.result;
    } else {
      throw new Error(response.data.description);
    }
  } catch (error) {
    throw new Error(`Failed to create forum topic: ${error.message}`);
  }
}

// Delete forum topic using raw API call
async function deleteForumTopic(chatId, messageThreadId) {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${token}/deleteForumTopic`, {
      chat_id: chatId,
      message_thread_id: messageThreadId
    });
    
    if (!response.data.ok) {
      throw new Error(response.data.description);
    }
  } catch (error) {
    throw new Error(`Failed to delete forum topic: ${error.message}`);
  }
}

// Utility function to update config file
const updateConfigFile = () => {
  const configPath = path.join(__dirname, 'channelConfig.js');
  const configContent = `// channelConfig.js\n\nconst channelThreadMap = {\n${Object.entries(channelThreadMap)
    .map(([name, id]) => `  '${name}': '${id}'`)
    .join(',\n')}\n};\n\nmodule.exports = {\n  channelThreadMap\n};`;
  fs.writeFileSync(configPath, configContent, 'utf8');
};

// Command to show topics management menu
bot.onText(/\/topics/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    
    if (chatId !== ADMIN_CHAT_ID) {
      await bot.sendMessage(chatId, 'عذراً، هذا الأمر متاح فقط في غرفة الإدارة ❌');
      return;
    }

    await bot.sendMessage(chatId, 'الرجاء اختيار العملية المطلوبة:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'إضافة غرفة جديدة ➕', callback_data: 'add_topic' }],
          [{ text: 'حذف غرفة ➖', callback_data: 'show_remove_topics' }],
          [{ text: 'عرض جميع الغرف 📋', callback_data: 'list_topics' }]
        ]
      }
    });
  } catch (error) {
    console.error('خطأ في عرض قائمة إدارة المواضيع:', error);
    await bot.sendMessage(msg.chat.id, 'حدث خطأ، يرجى المحاولة مرة أخرى ❌');
  }
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const chatGroupId = -1002179587442;


  try {
    switch (callbackQuery.data) {
      case 'add_topic':
        userStates.set(userId, 'waiting_for_room_name');
        await bot.editMessageText(
          'الرجاء إدخال اسم الغرفة الجديدة:', 
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: 'إلغاء ❌', callback_data: 'cancel_operation' }]]
            }
          }
        );
        break;

      case 'show_remove_topics':
        const removeButtons = Object.keys(channelThreadMap).map(room => ([{
          text: room,
          callback_data: `confirm_remove_${room}`
        }]));
        
        await bot.editMessageText('اختر الغرفة التي تريد حذفها:', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              ...removeButtons,
              [{ text: 'رجوع 🔙', callback_data: 'back_to_menu' }]
            ]
          }
        });
        break;

      case 'list_topics':
        const topicsList = Object.entries(channelThreadMap)
          .map(([name, id]) => `🔸 ${name}\nالمعرف: ${id.split('_')[1]}`)
          .join('\n\n');
        
        await bot.editMessageText(`قائمة الغرف الحالية:\n\n${topicsList}`, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[{ text: 'رجوع 🔙', callback_data: 'back_to_menu' }]]
          }
        });
        break;

      case 'cancel_operation':
        userStates.delete(userId);
        await bot.editMessageText('تم إلغاء العملية ❌', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[{ text: 'رجوع 🔙', callback_data: 'back_to_menu' }]]
          }
        });
        break;

      case 'back_to_menu':
        await bot.editMessageText('الرجاء اختيار العملية المطلوبة:', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'إضافة غرفة جديدة ➕', callback_data: 'add_topic' }],
              [{ text: 'حذف غرفة ➖', callback_data: 'show_remove_topics' }],
              [{ text: 'عرض جميع الغرف 📋', callback_data: 'list_topics' }]
            ]
          }
        });
        break;

      default:
        if (callbackQuery.data.startsWith('confirm_remove_')) {
          const roomName = callbackQuery.data.replace('confirm_remove_', '');
          await bot.editMessageText(
            `هل أنت متأكد من حذف الغرفة "${roomName}"؟`,
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: 'نعم، احذف ✅', callback_data: `delete_${roomName}` },
                    { text: 'لا، إلغاء ❌', callback_data: 'show_remove_topics' }
                  ]
                ]
              }
            }
          );
        } else if (callbackQuery.data.startsWith('delete_')) {
          const roomName = callbackQuery.data.replace('delete_', '');
          const threadId = channelThreadMap[roomName].split('_')[1];
          
          try {
            // Delete the topic from Telegram
            await deleteForumTopic(chatId, threadId);
            
            // Remove from our mapping
            delete channelThreadMap[roomName];
            updateConfigFile();
            
            await bot.editMessageText(
              `تم حذف الغرفة "${roomName}" بنجاح ✅`,
              {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [[{ text: 'رجوع 🔙', callback_data: 'back_to_menu' }]]
                }
              }
            );
          } catch (error) {
            console.error('Error deleting topic:', error);
            await bot.editMessageText(
              `حدث خطأ أثناء حذف الغرفة "${roomName}" ❌\nالرجاء المحاولة مرة أخرى`,
              {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [[{ text: 'رجوع 🔙', callback_data: 'back_to_menu' }]]
                }
              }
            );
          }
        }
        break;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('خطأ في معالجة العملية:', error);
    await bot.editMessageText('حدث خطأ، يرجى المحاولة مرة أخرى ❌', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: 'رجوع 🔙', callback_data: 'back_to_menu' }]]
      }
    });
  }
});

// Handle user messages for room creation
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const state = userStates.get(userId);

  if (chatId !== ADMIN_CHAT_ID) return;

  if (state === 'waiting_for_room_name') {
    const roomName = msg.text.trim();

    try {
      // Validate room name
      if (roomName.length < 2 || roomName.length > 30) {
        await bot.sendMessage(chatId, 'عذراً، يجب أن يكون اسم الغرفة بين 2 و 30 حرف ❌');
        return;
      }

      // Check if room name already exists
      if (channelThreadMap[roomName]) {
        await bot.sendMessage(chatId, 'عذراً، هذا الاسم موجود مسبقاً ❌');
        return;
      }

      // Create topic using our custom function
      const topic = await createForumTopic(chatGroupId, roomName);
      
      // Add new topic to channelThreadMap
      channelThreadMap[roomName] = `${chatId}_${topic.message_thread_id}`;

      // Update the configuration file
      updateConfigFile();

      // Send success message
      const successMessage = `تم إنشاء الغرفة بنجاح ✅\n\nاسم الغرفة: ${roomName}\nالمعرف: ${topic.message_thread_id}`;
      await bot.sendMessage(chatId, successMessage);

      console.log('تم تحديث قائمة الغرف:', channelThreadMap);
    } catch (error) {
      console.error('خطأ في إنشاء الغرفة:', error);
      await bot.sendMessage(chatId, 'حدث خطأ أثناء إنشاء الغرفة، يرجى المحاولة مرة أخرى ❌');
    }

    // Clear user state
    userStates.delete(userId);
  }
});


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
