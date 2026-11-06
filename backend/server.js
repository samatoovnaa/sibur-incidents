const http = require('http');
const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

// Игнорируем проверку сертификатов Сбера
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const server = http.createServer(async (req, res) => {
    // 🛡️ ЖЕЛЕЗОБЕТОННЫЙ CORS (отвечаем на все запросы браузера)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Если браузер делает предварительный запрос OPTIONS — сразу говорим "ОК"
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Обработка нажатия кнопки "AI-анализ"
    if (req.method === 'POST' && req.url === '/api/ai-analyze') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        
        req.on('end', async () => {
            try {
                console.log('\n--> ПОЛУЧЕН ЗАПРОС ОТ САЙТА!'); 
                const data = JSON.parse(body);
                const { title, description, severity, source } = data;
                
                const prompt = `Ты — эксперт по кибербезопасности. Проанализируй инцидент: Название: ${title}. Описание: ${description}. Критичность: ${severity}. Источник: ${source}. Дай краткие рекомендации (2-3 пункта) по устранению угрозы. Ответь на русском языке.`;

                const authKey = process.env.GIGACHAT_AUTH_KEY;
                if (!authKey) throw new Error("Ключ GIGACHAT_AUTH_KEY не найден в файле .env");

                console.log('--> Авторизация в GigaChat...');
                
                // 1. Получаем токен
                const authReq = https.request({
                    hostname: 'ngw.devices.sberbank.ru',
                    port: 9443,
                    path: '/api/v2/oauth',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                        'RqUID': crypto.randomUUID(),
                        'Authorization': `Basic ${authKey}`
                    },
                    agent: httpsAgent
                }, (authRes) => {
                    let authData = '';
                    authRes.on('data', d => authData += d);
                    authRes.on('end', () => {
                        try {
                            const token = JSON.parse(authData).access_token;
                            if (!token) throw new Error("Не удалось получить токен: " + authData);
                            
                            console.log('--> Токен получен! Отправка в GigaChat...');

                            // 2. Отправляем запрос в GigaChat
                            const aiReq = https.request({
                                hostname: 'gigachat.devices.sberbank.ru',
                                port: 443,
                                path: '/api/v1/chat/completions',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                agent: httpsAgent
                            }, (aiRes) => {
                                let aiData = '';
                                aiRes.on('data', d => aiData += d);
                                aiRes.on('end', () => {
                                    try {
                                        const response = JSON.parse(aiData);
                                        if (response.choices && response.choices[0]) {
                                            console.log('--> ОТВЕТ ОТ ИИ ПОЛУЧЕН!');
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({ success: true, recommendation: response.choices[0].message.content }));
                                        } else {
                                            throw new Error("Неверный ответ от GigaChat: " + aiData);
                                        }
                                    } catch (e) {
                                        console.error('Ошибка парсинга ИИ:', e);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: false, error: e.message }));
                                    }
                                });
                            });
                            aiReq.on('error', (e) => { 
                                res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.message })); 
                            });
                            aiReq.write(JSON.stringify({
                                model: 'GigaChat',
                                messages: [{ role: 'user', content: prompt }],
                                temperature: 0.7
                            }));
                            aiReq.end();
                        } catch (e) {
                            console.error('Ошибка авторизации:', e);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: e.message }));
                        }
                    });
                });
                authReq.on('error', (e) => { 
                    res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.message })); 
                });
                authReq.write('scope=GIGACHAT_API_PERS');
                authReq.end();

            } catch (err) {
                console.error('ОШИБКА НА СЕРВЕРЕ:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else {
        // Если зашли по обычному адресу в браузере
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Сервер GigaChat работает. Используйте POST-запросы с сайта.');
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`);
});