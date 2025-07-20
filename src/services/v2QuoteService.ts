// src/services/v2QuoteService.ts

import { ethers } from 'ethers';
import 'dotenv/config';
import { getTokenDecimals } from '../utils/prepareTokens';

// Eliminar la clase QuoteError y usar solo esta:
export class V2QuoteError extends Error {
  constructor(
    public readonly context: {
      tokenIn: string;
      tokenOut: string;
      // amount: number; // OLD
      amount: BigNumber; // NEW: Cambiar a BigNumber
      dex: string;
    },
    originalError: unknown
  ) {
    super(`V2 Quote failed: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
  }
}

export const getV2Quote = async (
  // amount: number, // OLD: Cambiar el tipo de 'amount'
  amount: BigNumber, // NEW: Recibir BigNumber directamente
  tokenIn: string,
  tokenOut: string,
  dexConfig: { router: string; routerAbi: any[]; name: string }
) => {
  // Validación reforzada
  // if (amount <= 0) throw new Error("Amount must be positive"); // Esto ya no es necesario si amount es BigNumber
  if (amount.lte(0)) throw new Error("Amount must be positive (BigNumber)"); // Nueva validación
  if (!ethers.utils.isAddress(tokenIn)) throw new Error(`Invalid tokenIn: ${tokenIn}`);
  if (!ethers.utils.isAddress(tokenOut)) throw new Error(`Invalid tokenOut: ${tokenOut}`);
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) throw new Error("Tokens must be different");

  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    const router = new ethers.Contract(dexConfig.router, dexConfig.routerAbi, provider);

    // Obtener decimales del tokenIn de forma más robusta usando prepareTokens
    // const usdcAddress = process.env.MAINNET_USDC;
    // if (!usdcAddress) {
    //   throw new Error("MAINNET_USDC environment variable is not defined");
    // }
    // const decimals = tokenIn.toLowerCase() === usdcAddress.toLowerCase() ? 6 : 18; // OLD

    // No necesitamos parseUnits si `amount` ya es BigNumber y ya tiene los decimales correctos
    // El `amount` pasado a `getV2Quote` debería ser `aaveLiquidity.amount` que ya está en wei/unidades mínimas
    const amountIn = amount; // Usar el BigNumber directamente
    console.log(`[quote] ${dexConfig.name}: amountIn = ${amountIn.toString()} (from BigNumber)`);


    // Añadir timeout explícito
    const amountsOut = await Promise.race([
      router.getAmountsOut(amountIn, [tokenIn, tokenOut]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('V2 quote timeout')), 5000)
      )
    ]);

    if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
      throw new Error('Invalid response from router');
    }

    return amountsOut[1].toString();
  } catch (error) {
    console.error(`V2 Quote Error [${dexConfig.name}]:`, 
      error instanceof Error ? error.message : 'Unknown error');
    throw new V2QuoteError({ tokenIn, tokenOut, amount, dex: dexConfig.name }, error);
  }
};
