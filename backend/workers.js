import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import axios from 'axios';
import https from 'node:https';
import crypto from 'node:crypto';

const app = express();
app.use(express.json());

// Настройка CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

app.post('/api/ai-analyze', async (req, res) => {
  try {
    const { title, description, severity, source } = req.body;
    const prompt = `Ты — эксперт по кибербезопасности. Проанализируй инцидент: Название: ${title}. Описание: ${description}. Критичность: ${severity}. Источник: ${source}. Дай краткие рекомендации (2-3 пункта).`;

    const authKey = process.env.GIGACHAT_AUTH_KEY;
    if (!authKey) throw new Error("Ключ GIGACHAT_AUTH_KEY не найден");

    // Получение токена
    const authResponse = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      'scope=GIGACHAT_API_PERS',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': crypto.randomUUID(),
          'Authorization': `Basic ${authKey}`
        },
        httpsAgent
      }
    );

    // Запрос к GigaChat
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authResponse.data.access_token}`
        },
        httpsAgent
      }
    );

    res.json({ success: true, recommendation: response.data.choices[0].message.content });
  } catch (error) {
    console.error('Ошибка:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: 'Ошибка при обращении к ИИ' });
  }
});

// Экспорт для Cloudflare Workers
export default httpServerHandler(app);