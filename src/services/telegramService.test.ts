// src/services/telegramService.ts
import 'dotenv/config';
import { fetch } from 'undici';
import * as dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// Versión segura (reemplazo completo)
const safeStringify = (input: unknown): string => {
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.stack || input.message;
  
  try {
    return JSON.stringify(input, (_, value) => {
      if (typeof value === 'bigint') return `${value.toString()}n`;
      if (value instanceof Error) return value.stack || value.message;
      return value;
    });
  } catch {
    return '[Unserializable Data]';
  }
};

export async function sendTelegramMessage(rawMessage: unknown): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Telegram no configurado. Mensaje omitido.');
    return;
  }

  try {
    const message = safeStringify(rawMessage).slice(0, 4000);
    if (!message.trim()) return;

    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown', // Cambiado de HTML a Markdown para mejor compatibilidad
      disable_web_page_preview: true
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5000ms timeout

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    type SafeTelegramMessage = string | {
  [key: string]: string | number | boolean | bigint | SafeTelegramMessage | null | undefined;
};

    if (!response.ok) {
      let errorMsg = 'Unknown Telegram API error';
      try {
  const errorData = await response.json();
  const sanitizedErrorData = typeof errorData === 'object' && errorData !== null
    ? JSON.parse(JSON.stringify(errorData, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (value instanceof Error) return value.message;
        return value;
      }))
    : errorData;

  if (sanitizedErrorData && 'description' in sanitizedErrorData) {
    errorMsg = sanitizedErrorData.description || errorMsg;
  }
} catch (serializationError) {
  errorMsg = `HTTP ${response.status} (Failed to parse error response)`;
}
console.error('❌ Telegram API error:', errorMsg);
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? JSON.stringify(error.message, (_, value) => 
          typeof value === 'bigint' 
            ? value.toString() 
            : value
        ).replace(/"/g, '')
      : 'Unknown error';

    console.error('❌ Telegram error:', errorMessage);
  }
}