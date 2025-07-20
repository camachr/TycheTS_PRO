// src/services/v3QuoteService.ts

import { Contract, providers, ethers, BigNumber } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import 'dotenv/config';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

export class V3QuoteError extends Error {
  constructor(
    public readonly context: {
      tokenIn: string;
      tokenOut: string;
      amount: string;
      fee: number;
    },
    originalError: unknown
  ) {
    super(`V3 Quote failed: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
  }
}

export async function getV3Quote(
  provider: ethers.providers.Provider,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  fee: number,
  network: string
): Promise<string> {
  // Validaciones explícitas
  if (!ethers.utils.isAddress(tokenIn)) throw new Error(`Invalid tokenIn: ${tokenIn}`);
  if (!ethers.utils.isAddress(tokenOut)) throw new Error(`Invalid tokenOut: ${tokenOut}`);
  if (tokenIn === tokenOut) throw new Error("Identical tokens");
  
  const amountBN = ethers.BigNumber.from(amountIn);
  if (amountBN.lte(0)) throw new Error("Amount must be positive");

  const quoterAddress = process.env[`${network.toUpperCase()}_UNISWAP_V3_QUOTER`];
  if (!quoterAddress) throw new Error(`Quoter address missing for ${network}`);

  try {
    const quoter = new ethers.Contract(
      quoterAddress,
      ["function quoteExactInputSingle(address,address,uint24,uint256,uint160) returns (uint256)"],
      provider
    );
    
    return (await quoter.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      fee,
      amountBN,
      0
    )).toString();
  } catch (error) {
  throw new V3QuoteError(
    { tokenIn, tokenOut, amount: amountIn, fee },
    error
  );
  }
}