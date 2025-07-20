// src/services/scoreEngine.ts
import { getQuote } from './quoteEngine';
import { ethers } from 'ethers';
import { QuoteResult } from '../types';
import 'dotenv/config';


export async function findBestOpportunity(
  dexes: string[],
  tokenIn: string,
  tokenMid: string,
  tokenOut: string,
  amountIn: ethers.BigNumber,
  provider: ethers.providers.Provider
): Promise<{
  buyDex: string;
  sellDex: string;
  profit: ethers.BigNumber;
  quoteIn: QuoteResult;
  quoteOut: QuoteResult;
} | null> {
  let bestProfit = ethers.BigNumber.from(0);
  let bestResult: any = null;

  for (const buyDex of dexes) {
    const quoteIn = await getQuote(buyDex, tokenIn, tokenMid, amountIn, provider);
    if (!quoteIn) continue;

    for (const sellDex of dexes) {
      const quoteOut = await getQuote(sellDex, tokenMid, tokenOut, quoteIn.amountOut, provider);
      if (!quoteOut) continue;

      const profit = quoteOut.amountOut.sub(amountIn);
      if (profit.gt(bestProfit)) {
        bestProfit = profit;
        bestResult = {
          buyDex,
          sellDex,
          profit,
          quoteIn,
          quoteOut,
        };
      }
    }
  }

  return bestResult;
}
