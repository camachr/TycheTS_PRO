// src/services/quotes/balancerQuoter.ts

import { providers, BigNumber as EthersBigNumber } from 'ethers';
import { SwapTypes, BalancerSDK, Network } from '@balancer-labs/sdk';
import BigNumber from 'bignumber.js';
import 'dotenv/config';

export async function getBalancerQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  rpcUrl: string
): Promise<BigNumber | null> {
  try {
    const sdk = new BalancerSDK({
      network: Network.MAINNET,
      rpcUrl,
    });

    const swapInfo = await sdk.swaps.findRouteGivenIn({
      tokenIn,
      tokenOut,
      amount: EthersBigNumber.from(amountIn.toFixed(0)),
      gasPrice: EthersBigNumber.from(0),
      maxPools: 4,
    });

    if (!swapInfo || swapInfo.returnAmount.toString() === '0') return null;

    return new BigNumber(swapInfo.returnAmount.toString());
  } catch (error) {
    console.error(`❌ Error en getBalancerQuote: ${error}`);
    return null;
  }
}
