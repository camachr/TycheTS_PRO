// src/services/dexService.ts

import 'dotenv/config';
import { Contract, BigNumber, BigNumberish, providers } from 'ethers';
import { SupportedNetwork } from '../config/networks';

export type DexType = 'V2' | 'V3' | 'CURVE';

export const DEX_ABIS: Record<DexType, string[]> = {
  V2: [
    'function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] memory amounts)',
  ],
  V3: [
    'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)',
  ],
  CURVE: [
    'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
    'function coins(uint256) external view returns (address)',
  ],
};

export async function getCurveTokenIndex(pool: Contract, token: string): Promise<number> {
  for (let i = 0; i < 8; i++) {
    try {
      const coin = await pool.coins(i);
      if (coin.toLowerCase() === token.toLowerCase()) return i;
    } catch {
      break;
    }
  }
  throw new Error(`Token ${token} no encontrado en pool Curve`);
}

export async function getPriceQuote(
  router: string,
  tokenIn: string,
  tokenOut: string,
  amount: BigNumberish,
  provider: providers.Provider,
  network: SupportedNetwork,
  dexType: DexType = 'V2'
): Promise<{ amountOut: BigNumber | null; fee?: number }> {
  const abi = DEX_ABIS[dexType];
  const contract = new Contract(router, abi, provider);
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      switch (dexType) {
        case 'CURVE': {
          const i = await getCurveTokenIndex(contract, tokenIn);
          const j = await getCurveTokenIndex(contract, tokenOut);
          const amountOut = await contract.get_dy(i, j, amount);
          return { amountOut };
        }
        case 'V3': {
          const fees = [100, 500, 3000, 10000];
          let bestOut = BigNumber.from(0);
          let bestFee = 3000;

          for (const fee of fees) {
            try {
              const out = await contract.quoteExactInputSingle(tokenIn, tokenOut, fee, amount, 0);
              if (out.gt(bestOut)) {
                bestOut = out;
                bestFee = fee;
              }
            } catch (_) {
              continue;
            }
          }

          return { amountOut: bestOut.gt(0) ? bestOut : null, fee: bestFee };
        }
        default: {
          const amounts = await contract.getAmountsOut(amount, [tokenIn, tokenOut]);
          return { amountOut: amounts[1] };
        }
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (attempt === MAX_RETRIES - 1) console.error(`❌ Error en quote ${dexType}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  return { amountOut: null };
}