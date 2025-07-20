// src/utils/profitTracker.ts
import { BigNumber, ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { TelegramNotifier } from '../services/notificationService';
import 'dotenv/config';
const FILE_PATH = path.resolve(__dirname, '../../data/profit.json');
const NOTIFY_INTERVAL_MS = 60_000; // cada 60s
const THRESHOLD = ethers.utils.parseEther(process.env.NOTIFY_PROFIT_THRESHOLD || '0.05');

export class ProfitTracker {
  private static totalProfit = BigNumber.from(0);
  private static lastNotifiedProfit = BigNumber.from(0);

  static load(): void {
    try {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      const { total, lastNotified } = JSON.parse(raw);
      this.totalProfit = BigNumber.from(total);
      this.lastNotifiedProfit = BigNumber.from(lastNotified || 0);
    } catch {
      this.totalProfit = BigNumber.from(0);
      this.lastNotifiedProfit = BigNumber.from(0);
    }

    // Inicia monitoreo periódico al cargar
    this.startNotifier();
  }

  static add(profit: BigNumber): void {
    if (profit.gt(0)) {
      this.totalProfit = this.totalProfit.add(profit);
      fs.writeFileSync(
        FILE_PATH,
        JSON.stringify(
          {
            total: this.totalProfit.toString(),
            lastNotified: this.lastNotifiedProfit.toString()
          },
          null,
          2
        )
      );
    }
  }

  static get(): BigNumber {
    return this.totalProfit;
  }

  private static startNotifier(): void {
    setInterval(() => {
      const diff = this.totalProfit.sub(this.lastNotifiedProfit);
      if (diff.gte(THRESHOLD)) {
        this.lastNotifiedProfit = this.totalProfit;
        fs.writeFileSync(
          FILE_PATH,
          JSON.stringify(
            {
              total: this.totalProfit.toString(),
              lastNotified: this.lastNotifiedProfit.toString()
            },
            null,
            2
          )
        );
        TelegramNotifier.send(`📈 Ganancia acumulada: ${ethers.utils.formatEther(this.totalProfit)} ETH`);
      }
    }, NOTIFY_INTERVAL_MS);
  }
}
