//  src/services/arbitrageService.ts
import 'dotenv/config';

import { Contract, BigNumber, providers, ethers, PopulatedTransaction } from 'ethers';
import { getPriceQuote, DexType } from './dexService';
import { getAaveLiquidity } from './liquidityService';
import { sendTelegramMessage } from './telegramService';
import { trackNoLiquidity, resetNoLiquidityCounter } from '../utils/liquidityTracking';
import { 
  SupportedNetwork,
  TokenInfo,
  DexRouter,
  ArbitrageOpportunity
} from '../types';
import { estimateOptimalGas } from './gasService';
import { getVolatility } from '../config/volatility'; // Asegúrate de tener el path correcto
import { getTokenDecimals } from '../utils/prepareTokens';

// Dentro de tu función actual, reemplaza la parte del cálculo de slippage:


const PROFIT_MARGIN_PERCENT = Number(process.env.PROFIT_MARGIN || 0.03); // Mantenerlo como número para la configuración
const PROFIT_MARGIN_BPS = Math.round(PROFIT_MARGIN_PERCENT * 10000);

interface InternalOpportunity {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  routers: [string, string];
  amount: BigNumber;
  profit: BigNumber;
  gasCost: BigNumber;
  method: string;
  args: any[];
  fees: number[];
    slippage: number;
    network: 'mainnet';
    // If no opportunities found or loops not entered, return an empty array
  }

export async function findArbitrageOpportunities(
  provider: providers.Provider,
  contract: Contract,
  network: 'mainnet',
  tokens: TokenInfo[],
  dexes: DexRouter[],
  options: {
    maxHops?: number;
    dynamicSlippage?: boolean;
    volatilityData?: Record<string, number>;
    timeoutMs?: number;
  } = {}
): Promise<ArbitrageOpportunity[]> {
  if (!Array.isArray(dexes) || dexes.length === 0) {
    throw new Error('❌ DEX list is undefined or empty');
  }
  const {
    maxHops = 2,
    dynamicSlippage = false,
    volatilityData = {},
    timeoutMs = 30000
  } = options;

  const strategy = dynamicSlippage ? 'aggressive' : 'balanced';
  const internalOpportunities: InternalOpportunity[] = [];
  const startTime = Date.now();
  const whitelistCache = new Map<string, boolean>();

  // **CORRECCIÓN:** Se elimina la definición externa redundante.
  // Solo se mantiene la definición correcta y anidada.
  const getDexCombinations = (dexes: DexRouter[] = []): [DexRouter, DexRouter][] => {
    if (!Array.isArray(dexes)) return [];
    const pairs: [DexRouter, DexRouter][] = [];
    for (let i = 0; i < dexes.length; i++) {
      for (let j = 0; j < dexes.length; j++) {
        if (i !== j) pairs.push([dexes[i], dexes[j]]);
      }
    }
    return pairs;
  };

  for (const tokenIn of tokens) {
    if (!tokenIn.address || trackNoLiquidity(`${network}:${tokenIn.symbol}`)) continue;
    if (Date.now() - startTime > timeoutMs) break;

    for (const tokenOut of tokens) {
      if (
        !tokenOut.address ||
        tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()
      ) continue;

      try {
        const keyIn = `${network}:${tokenIn.address}`;
        const keyOut = `${network}:${tokenOut.address}`;

        const [isWhitelistedIn, isWhitelistedOut] = await Promise.all([
  whitelistCache.has(keyIn)
    ? whitelistCache.get(keyIn)!
    : contract.tokenWhitelist(tokenIn.address).then((r: boolean) => {
        whitelistCache.set(keyIn, r);
        return r;
      }),
  whitelistCache.has(keyOut)
    ? whitelistCache.get(keyOut)!
    : contract.tokenWhitelist(tokenOut.address).then((r: boolean) => {
        whitelistCache.set(keyOut, r);
        return r;
      })
]);

        if (!isWhitelistedIn || !isWhitelistedOut) continue;

        const aaveLiquidity = await getAaveLiquidity(contract, tokenIn.address, provider);
        if (aaveLiquidity.amount.lte(0)) {
          const key = `${network}:${tokenIn.symbol}`;
          if (trackNoLiquidity(key)) continue;
          resetNoLiquidityCounter(key);
        }

        const dexPairs = getDexCombinations(dexes);

        for (const [dex1, dex2] of dexPairs) {
          const [res1, res2] = await Promise.all([
            getPriceQuote(dex1.router, tokenIn.address, tokenOut.address, aaveLiquidity.amount, provider, network, dex1.type as DexType),
            getPriceQuote(dex2.router, tokenOut.address, tokenIn.address, aaveLiquidity.amount, provider, network, dex2.type as DexType),
          ]);

          if (!res1?.amountOut || !res2?.amountOut) continue;

          const returnAmount = res2.amountOut;
          const profit = returnAmount.sub(aaveLiquidity.amount);

          const adjustedSlippage = dynamicSlippage
            ? Math.min(
                1000, // Máximo 1000 (10%)
                Math.max(
                  50, // Mínimo 0.5%
                  100 + (getVolatility(network, tokenIn.address.toLowerCase()) * 1000)
                )
              )
            : 100; // 1% fijo si no es dinámico

          let gasCost: BigNumber;
          try {
            const tx: PopulatedTransaction = {
              to: contract.address,
              data: contract.interface.encodeFunctionData('executeFlashLoanAave', [
                tokenIn.address,
                aaveLiquidity.amount,
                [dex1.router, dex2.router],
                [tokenIn.address],
                [tokenOut.address],
                [
                  dex1.type === 'V3' ? (res1.fee ?? 3000) : 0,
                  dex2.type === 'V3' ? (res2.fee ?? 3000) : 0,
                ],
                adjustedSlippage,
                0,
                network === 'mainnet' ? BigNumber.from('10000000000000000') : 0,
              ])
            };

            const gasEstimates = await estimateOptimalGas(tx, provider as any, {
              network,
              strategy,
            });
            gasCost = gasEstimates.estimatedGasCost;
          } catch (err) {
            console.warn(`[⚠️ GAS] Estimación fallida: ${(err as Error).message}. Usando fallback`);
            gasCost = BigNumber.from('1500000');
          }
          const HUNDRED_PERCENT_BPS = BigNumber.from(10000); // 100% en basis points
          const PROFIT_MARGIN_AS_BPS_BN = BigNumber.from(PROFIT_MARGIN_BPS);
          const profitThreshold = gasCost.mul(PROFIT_MARGIN_AS_BPS_BN).div(HUNDRED_PERCENT_BPS);

          if (profit.gt(profitThreshold)) {
            const fees = [
              dex1.type === 'V3' ? (res1.fee ?? 3000) : 0,
              dex2.type === 'V3' ? (res2.fee ?? 3000) : 0,
            ];

            internalOpportunities.push({
          tokenIn,
          tokenOut,
          routers: [dex1.router, dex2.router],
          amount: aaveLiquidity.amount,
          profit,
          gasCost,
          method: 'executeFlashLoanAave',
          args: [
            tokenIn.address,
            aaveLiquidity.amount,
            [dex1.router, dex2.router],
            [tokenIn.address],
            [tokenOut.address],
            fees,
            adjustedSlippage,
            // ANTES: 0, // minProfit
            profitThreshold, // AHORA: Pasa el profitThreshold calculado
            network === 'mainnet' ? BigNumber.from('10000000000000000') : BigNumber.from(0), // Asegurarse de que sea BigNumber
          ],
          fees,
          slippage: adjustedSlippage,
          network,
        });
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`🔴 Error en ${tokenIn.symbol}/${tokenOut.symbol}: ${error.message}`);
    // Considera hacer este mensaje más específico si el error es de `estimation failed` o `underflow`
    await sendTelegramMessage(`❌ Error en arbitraje: ${tokenIn.symbol}/${tokenOut.symbol}\n${error.message}`);
  }
}
  }
  return internalOpportunities
    .map(opp => ({
      path: [opp.tokenIn.address, opp.tokenOut.address],
      amountIn: opp.amount,
      minAmountOut: BigNumber.from(0),
      dexes: opp.routers,
      estimatedProfit: opp.profit,
      estimatedGasCost: opp.gasCost,
      fees: opp.fees,
      slippage: opp.slippage,
      network: opp.network
    }))
    .sort((a, b) => b.estimatedProfit.sub(a.estimatedProfit).toNumber())
    .slice(0, 20); // Limita a los 20 más rentables
}
