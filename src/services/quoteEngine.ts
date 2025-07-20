// src/services/quoteEngine.ts
import { ethers } from 'ethers';
import { dexRegistry } from '../config/dexRegistry';
import { DexType, QuoteResult } from '../types';
import { getV2Quote } from './v2QuoteService';
import { getV3Quote } from './v3QuoteService';
import { getBalancerQuote } from './quotes/balancerQuoter';
import BigNumberJs from 'bignumber.js';
import 'dotenv/config';


export async function getQuote(
  dex: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: ethers.BigNumber,
  provider: ethers.providers.Provider
): Promise<QuoteResult | null> {
  const dexEntry = dexRegistry[dex];
  if (!dexEntry) {
    console.warn(`❌ DEX ${dex} no registrado`);
    return null;
  }

  try {
    switch (dexEntry.type) {
      case 'V2':
  const amountNumber = parseFloat(ethers.utils.formatUnits(amountIn, 18));
  const v2Result = await getV2Quote(
    amountNumber,
    tokenIn,
    tokenOut,
    {
      router: dexEntry.address,
      routerAbi: [  // Añadimos el ABI básico necesario para V2
        "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)"
      ],
      name: dex
    }
  );
  return {
    amountOut: ethers.BigNumber.from(v2Result),
    route: [tokenIn, tokenOut],
    dex
  };
      case 'V3':
        if (typeof dexEntry.fee !== 'number') {
          throw new Error(`Fee is required for V3 DEX: ${dex}`);
        }
        if (!dexEntry.network) {
          throw new Error(`Network is required for V3 DEX: ${dex}`);
        }
        const v3Result = await getV3Quote(
          provider,
          tokenIn,
          tokenOut,
          amountIn.toString(),
          dexEntry.fee,
          dexEntry.network
        );
        // If getV3Quote returns a string, wrap or convert it to QuoteResult as needed
        if (typeof v3Result === 'string') {
          // Convert v3Result to BigNumber and provide an empty route or appropriate route array
          return { amountOut: ethers.BigNumber.from(v3Result), route: [], dex };
        }
        return v3Result;
        const balancerAmountOut = await getBalancerQuote(
          tokenIn,
          tokenOut,
          new BigNumberJs(amountIn.toString()),
          (provider as any).connection.url
        );
        if (balancerAmountOut === null) {
          return null;
        }
        return { amountOut: ethers.BigNumber.from(balancerAmountOut), route: [], dex };
      // case 'CURVE':
      //   return await getCurveQuote(...);
      default:
        console.warn(`❌ Tipo de DEX no soportado: ${dexEntry.type}`);
        return null;
    }
  } catch (error: any) {
    console.error(`⚠️ Error en quote para ${dex}:`, error.reason || error.message || error);
    return null;
  }
}
