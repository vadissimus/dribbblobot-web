const puppeteer = require('puppeteer');
const axios = require('axios');

// Конфигурация Telegram
const TELEGRAM_BOT_TOKEN = "1928613478:AAH9ZOvk9JkxSPtUnDugdVGrFKhtBGtKLtM";
const TELEGRAM_CHAT_ID = "-1002077402136";
const TELEGRAM_THREAD_ID = 3;
const DELAY_BETWEEN_MESSAGES = 5000; // 5 секунд

async function scrapeDribbble() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
        console.log('Загрузка страницы Dribbble...');

        // 1. Переходим на сайт
        await page.goto('https://dribbble.com/shots/popular/web-design', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 2. Ждем полной загрузки страницы
        await page.waitForSelector('li.shot-thumbnail');

        // Добавляем прокрутку страницы для подгрузки большего количества данных
        console.log('Прокрутка страницы для загрузки дополнительного контента...');
        await autoScroll(page);

        // 3. Собираем ссылки на картинки
        const imageLinks = await page.$$eval(
            'li.shot-thumbnail > div > figure > img',
            (imgs) => imgs.map(img => {
                let src = img.getAttribute('data-src') || img.getAttribute('src');
                if (!src) return 'нет data-src и src';
                
                // Убираем всё после "?" и добавляем новый параметр
                const cleanSrc = src.split('?')[0];
                return `${cleanSrc}?format=webp&resize=2000x1500`;
            })
        );

        // 4. Выводим ссылки на картинки
        console.log('Ссылки на картинки:');
        imageLinks.forEach((link, index) => {
            console.log(`${index + 1}. ${link}`);
        });

        // 5. Собираем сылки на шоты
        const shotIds = await page.$$eval(
            'li.shot-thumbnail',
            (items) => items.map(item => {
                const id = item.getAttribute('data-thumbnail-id');
                return id || 'нет id';
            })
        );

        // 6. Выводим ссылки на шоты
        console.log('\nСсылки на шоты:');
        shotIds.forEach((id, index) => {
            console.log(`${index + 1}. https://dribbble.com/shots/${id}`);
        });

        // 7. Собираем ссылки на авторов
        const authorLinks = await page.$$eval(
            'li.shot-thumbnail > div > div > a.hoverable.url',
            (links) => links.map(link => {
                const href = link.getAttribute('href');
                return href || 'нет ссылки на автора';
            })
        );

        // 8. Выводим ссылки на авторов
        console.log('\nСсылки на авторов:');
        authorLinks.forEach((link, index) => {
            console.log(`${index + 1}. https://dribbble.com${link}`);
        });

        // Форматирование даты
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const currentDate = new Date().toLocaleDateString('ru-RU', dateOptions).replace(' г.', '');

        // Отправляем картинки в Telegram
        console.log('\nНачинаем отправку картинок в Telegram...');
        for (let i = 0; i < 25 && i < imageLinks.length; i++) {
            const imageUrl = imageLinks[i];
            const shotId = shotIds[i];
            const authorLink = authorLinks[i];

            if (imageUrl && imageUrl !== 'нет data-src и src') {
                const caption = `${currentDate} | Web | ${i + 1}\nШот: https://dribbble.com/shots/${shotId}\nАвтор: https://dribbble.com${authorLink}`;
                
                try {
                    await sendTelegramPhoto(imageUrl, caption);
                    console.log(`Отправлено изображение ${i + 1}/25`);
                    
                    // Задержка между сообщениями
                    if (i < 24) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
                    }
                } catch (error) {
                    console.error(`Ошибка при отправке изображения ${i + 1}:`, error.message);
                }
            }
        }

    } catch (error) {
        console.error('Произошла ошибка:', error);
    } finally {
        await browser.close();
    }
}

// Функция для автоматической прокрутки страницы
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            window.scrollBy(0, 1000);
            // Даем небольшой таймаут для подгрузки контента после скролла
            setTimeout(resolve, 1000);
        });
    });
}

// Функция для отправки фото в Telegram
async function sendTelegramPhoto(photoUrl, caption) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    const params = {
        chat_id: TELEGRAM_CHAT_ID,
        photo: photoUrl,
        caption: caption,
        message_thread_id: TELEGRAM_THREAD_ID,
        parse_mode: 'HTML'
    };

    try {
        const response = await axios.post(url, params);
        return response.data;
    } catch (error) {
        throw new Error(`Telegram API error: ${error.response?.data?.description || error.message}`);
    }
}

scrapeDribbble();
