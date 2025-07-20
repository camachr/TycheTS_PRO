// src/services/quotes/getQuoteForDex.ts

import { BigNumber, providers } from 'ethers';
import { getUniswapV2Quote } from './uniswapV2Quoter';
import { getUniswapV3Quote } from './uniswapV3Quoter';
import { getBalancerQuote } from './balancerQuoter';
import { parseUnits } from 'ethers/lib/utils';
import BigNumberJs from 'bignumber.js';
import 'dotenv/config';

type DexType = 'UNISWAP_V2' | 'UNISWAP_V3' | 'BALANCER';

interface DexInfo {
  type: DexType;
  router: string;
  quoter?: string;
  feeTier?: number; // para Uniswap V3
}

export async function getQuoteForDex(
  dex: DexInfo,
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  provider: providers.JsonRpcProvider
): Promise<BigNumber | null> {
  switch (dex.type) {
    case 'UNISWAP_V2':
      return await getUniswapV2Quote(dex.router, tokenIn, tokenOut, amountIn, provider);

    case 'UNISWAP_V3':
      if (!dex.quoter || dex.feeTier === undefined) return null;
      return await getUniswapV3Quote(dex.quoter, tokenIn, tokenOut, dex.feeTier, amountIn, provider);

    case 'BALANCER':
    // getBalancerQuote returns a string or BigNumber depending on implementation.
    // To avoid type issues, ensure amountIn is passed as a string if getBalancerQuote expects a string.
    const balancerQuote = await getBalancerQuote(
      tokenIn,
      tokenOut,
      new BigNumberJs(amountIn.toString()), // convert ethers.BigNumber to bignumber.js BigNumber
      provider.connection.url
    );
      return balancerQuote === null ? null : BigNumber.from(balancerQuote.toString());
      return balancerQuote === null ? null : BigNumber.from(balancerQuote);

    default:
      return null;
  }
}

