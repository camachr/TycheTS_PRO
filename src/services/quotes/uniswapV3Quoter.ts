// src/services/quotes/uniswapV3Quoter.ts

import { Contract, BigNumber, providers } from 'ethers';
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import 'dotenv/config';

export async function getUniswapV3Quote(
  quoterAddress: string,
  tokenIn: string,
  tokenOut: string,
  fee: number,
  amountIn: BigNumber,
  provider: providers.JsonRpcProvider
): Promise<BigNumber | null> {
  try {
    const quoter = new Contract(quoterAddress, QuoterABI, provider);
    const amountOut = await quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, 0);
    return amountOut;
  } catch (error) {
    console.error(`❌ Error en getUniswapV3Quote: ${error}`);
    return null;
  }
}
