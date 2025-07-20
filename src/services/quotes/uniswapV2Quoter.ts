// src/services/quotes/uniswapV2Quoter.ts
import { Contract, BigNumber, providers } from 'ethers';
import IUniswapV2Router from '../../abi/IUniswapV2Router.json'; // Asegúrate que el ABI esté presente
import 'dotenv/config';

export async function getUniswapV2Quote(
  routerAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  provider: providers.JsonRpcProvider
): Promise<BigNumber | null> {
  try {
    const router = new Contract(routerAddress, IUniswapV2Router, provider);
    const amountsOut = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amountsOut[1]; // tokenOut
  } catch (error) {
    console.error(`❌ Error en getUniswapV2Quote: ${error}`);
    return null;
  }
}
