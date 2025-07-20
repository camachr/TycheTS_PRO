// src/services/notificationService.ts
import axios from 'axios';
import { Logger } from '../utils/logger';
import { sendTelegramMessage } from './telegramService';
import 'dotenv/config';

type TelegramConfig = {
  botToken: string;
  chatId: string;
  enabled: boolean;
};

class NotificationService {
  private config: TelegramConfig;
  private failureCount = 0;
  private readonly maxFailures = 5;
  private readonly cooldownMs = 5 * 60 * 1000; // 5 minutos
  private silentUntil: number = 0;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): TelegramConfig {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '';

    return {
      botToken,
      chatId,
      enabled: !!botToken && !!chatId
    };
  }

  private logStatus(): void {
    if (this.config.enabled) {
      Logger.info('📩 Telegram notifications enabled');
    } else {
      Logger.warn('⚠️ Telegram notifications disabled: missing credentials');
    }
  }

  public async send(message: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    const now = Date.now();
    if (now < this.silentUntil) {
      Logger.warn('⚠️ Telegram temporarily silenced due to repeated failures');
      return false;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        },
        { timeout: 5000 }
      );

      if (this.failureCount > 0) {
        Logger.success('✅ Telegram restored after failures');
        this.failureCount = 0;
      }
      return true;

    } catch (error) {
      this.failureCount += 1;
      Logger.error(`❌ Telegram send failed (${this.failureCount}): ${error instanceof Error ? error.message : String(error)}`);

      if (this.failureCount >= this.maxFailures) {
        this.silentUntil = now + this.cooldownMs;
        Logger.error(`🚫 Telegram silenced for ${this.cooldownMs / 1000 / 60} minutes after ${this.maxFailures} failures`);
      }
      return false;
    }
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }
}

export const TelegramNotifier = new NotificationService();
if (TelegramNotifier['config'].enabled) {
  Logger.info('📩 Telegram notifications enabled');
} else {
  Logger.warn('⚠️ Telegram notifications disabled: missing credentials');
}

export async function notifyError(error: unknown, context: string): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await sendTelegramMessage(`[${context.toUpperCase()}_ERROR] ${message}`);
}