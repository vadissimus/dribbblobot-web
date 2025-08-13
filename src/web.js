const puppeteer = require('puppeteer');
const axios = require('axios');

// Конфигурация из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_THREAD_ID = 3;
const DELAY_BETWEEN_MESSAGES = 5000; // 5 секунды задержки между сообщениями

async function sendTelegramPhoto(imageUrl, caption) {
  try {
    const processedUrl = `${imageUrl.split('?')[0]}?format=webp&resize=2000x1500`;
    
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      chat_id: TELEGRAM_CHAT_ID,
      message_thread_id: TELEGRAM_THREAD_ID,
      photo: processedUrl,
      caption: caption,
      parse_mode: 'HTML'
    });
    console.log(`Изображение отправлено: ${processedUrl.split('/').pop()}`);
  } catch (error) {
    console.error('Ошибка при отправке фото:', error.message);
    console.log('Проблемный URL:', imageUrl);
  }
}

async function scrapeDribbbleImages() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важно для работы в GitHub Actions
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Загрузка страницы Dribbble...');
    await page.goto('https://dribbble.com/shots/popular/web-design', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('li.shot-thumbnail');
    
    console.log('Сбор и обработка изображений...');
    const imagesData = await page.$$eval(
      'li.shot-thumbnail', 
      (shots) => shots.slice(0, 22).map(shot => {
        const img = shot.querySelector('div figure img');
        const src = img ? (img.getAttribute('data-src') || img.src) : null;
        const cleanUrl = src ? src.split('?')[0] : null;
        const shotId = shot.getAttribute('data-thumbnail-id');
        
        // Ищем дополнительную ссылку
        const additionalLink = shot.querySelector('div > div > a.hoverable.url');
        const href = additionalLink ? additionalLink.getAttribute('href') : null;
        const fullAdditionalUrl = href ? `https://dribbble.com${href}` : 'Не найдено';

        return {
          url: cleanUrl,
          shotUrl: `https://dribbble.com/shots/${shotId}`,
          additionalUrl: fullAdditionalUrl
        };
      })
    );

    // Форматирование даты
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const currentDate = new Date().toLocaleDateString('ru-RU', dateOptions).replace(' г.', '');
    
    console.log('\nНачинаю отправку изображений в Telegram...');
    for (const [index, image] of imagesData.entries()) {
      if (image.url) {
        const caption = `${currentDate} | Web | ${index + 1}\nШот: ${image.shotUrl}\nАвтор: ${image.additionalUrl}`;
        await sendTelegramPhoto(image.url, caption);
        
        if (index < imagesData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
        }
      }
    }
    
    console.log(`\nОтправка завершена. Всего отправлено: ${imagesData.filter(img => img.url).length} изображений`);
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await browser.close();
  }
}

// Обработка ошибок верхнего уровня
scrapeDribbbleImages()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Фатальная ошибка:', error);
    process.exit(1);
  });
