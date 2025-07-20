import { fetch } from 'undici';
import * as dotenv from 'dotenv';
dotenv.config();

const safeStringify = (input: unknown): string => {
  if (input === undefined) return '[undefined]';
  if (input === null) return '[null]';
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  if (input instanceof Error) return input.stack || input.message;
  
  try {
    return JSON.stringify(input, (_, value) => {
      if (value === undefined) return '[undefined]';
      if (value === null) return '[null]';
      if (typeof value === 'bigint') return value.toString() + 'n';
      if (value instanceof Error) return value.stack || value.message;
      return value;
    });
  } catch (error) {
    return `[Serialization Error: ${error instanceof Error ? error.message : String(error)}]`;
  }
};

export async function sendTelegramMessage(message: string): Promise<void> {
  // 1. Validación básica
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    // 2. Solo acepta strings - ¡Nada de objetos complejos!
    const text = message.slice(0, 4000);
    
    // 3. Serialización MANUAL del body (convertimos a texto ANTES de enviar)
    const bodyText = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });

    // 4. Envío directo con el cuerpo ya convertido a texto
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText, // ¡Ya es texto!
      signal: AbortSignal.timeout(3000) // Timeout corto
    });
  } catch (error) {
    console.error('⚠️ Error Telegram (no crítico)');
  }
}