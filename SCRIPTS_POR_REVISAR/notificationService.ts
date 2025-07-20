// Esta es la última versión entregada por Deepseek. Tiene funcionalidades adicionales
// Beneficios Clave de la Versión Mejorada
//Sistema de Colas Prioritarias: Maneja mensajes según importancia
// Reintentos Inteligentes: Para errores transitorios (rate limits, timeouts)
// Métricas Completas: Seguimiento de éxito/fallo y estado operacional
// Procesamiento Asincrónico: No bloqueante para la aplicación principal
// Tipado de Errores: Manejo específico para diferentes tipos de fallos
// src/services/notificationService.ts
import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger';
import { delay } from '../utils/timeUtils';

type TelegramConfig = {
  botToken: string;
  chatId: string;
  enabled: boolean;
};

type Message = {
  text: string;
  priority: 'critical' | 'high' | 'normal';
  timestamp: number;
};

class NotificationService {
  private config: TelegramConfig;
  private failureCount = 0;
  private successCount = 0;
  private readonly maxFailures = 5;
  private readonly cooldownMs = 5 * 60 * 1000;
  private silentUntil = 0;
  private queue: Message[] = [];
  private isProcessing = false;

  constructor() {
    this.config = this.loadConfig();
    this.logStatus();
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
      Logger.info(`📩 Telegram notifications enabled | Chat ID: ${this.config.chatId.substring(0, 3)}...`);
    }
  }

  public async send(message: string, priority: 'critical' | 'high' | 'normal' = 'normal'): Promise<boolean> {
    if (!this.config.enabled) return false;

    this.queue.push({
      text: message,
      priority,
      timestamp: Date.now()
    });

    if (!this.isProcessing) {
      return this.processQueue();
    }

    return true;
  }

  private async processQueue(): Promise<boolean> {
    this.isProcessing = true;
    let success = true;

    while (this.queue.length > 0 && success) {
      // Ordenar por prioridad y antigüedad
      this.queue.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority] || 
               a.timestamp - b.timestamp;
      });

      const message = this.queue.shift()!;
      success = await this.sendImmediate(message.text);
    }

    this.isProcessing = false;
    return success;
  }

  private async sendImmediate(message: string): Promise<boolean> {
    const now = Date.now();
    if (now < this.silentUntil) return false;

    try {
      await this.attemptSend(message);
      this.successCount++;
      return true;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  private async attemptSend(message: string, retries = 2): Promise<void> {
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
        Logger.success(`✅ Telegram restored after ${this.failureCount} failures`);
        this.failureCount = 0;
      }
    } catch (error) {
      if (this.isTransientError(error) && retries > 0) {
        await delay(1000 * (3 - retries));
        return this.attemptSend(message, retries - 1);
      }
      throw error;
    }
  }

  private isTransientError(error: AxiosError): boolean {
    return error.response?.status === 429 || error.code === 'ECONNABORTED';
  }

  private handleError(error: AxiosError): boolean {
    this.failureCount++;
    this.lastError = error;

    Logger.error(`❌ Telegram send failed (${this.failureCount}): ${
      error.response?.data?.description || error.message
    }`);

    if (this.failureCount >= this.maxFailures) {
      this.silentUntil = Date.now() + this.cooldownMs;
      Logger.error(`🚫 Telegram silenced for ${this.cooldownMs / 1000 / 60} minutes`);
    }

    return false;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getStatus() {
    return {
      enabled: this.config.enabled,
      operational: this.failureCount < this.maxFailures,
      failures: this.failureCount,
      successes: this.successCount,
      silenced: this.silentUntil > Date.now()
    };
  }
}

export const TelegramNotifier = new NotificationService();