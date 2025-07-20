// src/types.ts
import { BigNumber } from 'ethers';
import 'dotenv/config';
// Tipo para oportunidades detectadas
export interface Opportunity {
  path: string[];
  amountIn: BigNumber | string | number;
  minAmountOut: BigNumber | string | number;
  dexes: string[];
  estimatedProfit: BigNumber | string | number;
}

// Tipo para oportunidades ya procesadas (usado en ejecución)
export interface ArbitrageOpportunity {
  path: string[];
  amountIn: BigNumber;
  minAmountOut: BigNumber;
  dexes: string[];
  estimatedProfit: BigNumber;
  estimatedGasCost?: BigNumber;
  executionRisk?: number;
  fees?: number[];               // ✅ Añadido para soportar V3 dinámico
  slippage?: number;             // ✅ Útil para tolerancia de ejecución
  network?: SupportedNetwork;   // ✅ Si aún no estaba, mejora trazabilidad
}


export interface DexInfo {
  name: string;
  router: string;
  type: 'V2' | 'V3';
  quoter?: string; // Solo para V3
  fees?: Record<string, number>; // Solo para V3, ej: {'USDC_WETH': 3000}
}
// Tipado para red soportada
export type SupportedNetwork = 'mainnet';
// src/types.ts

export type DexType = 'V2' | 'V3' | 'BALANCER' | 'CURVE';

export interface QuoteResult {
  amountOut: BigNumber;
  route: string[];
  dex: string; // Opcional, si es necesario identificar el DEX
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface DexRouter {
  name: string;
  router: string;
  type: DexType;
}

export interface DetailedOpportunity {
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
  network: SupportedNetwork;
}

export interface SlippageParams {
  volatility: number; // 0-1 (0.1 = 10%)
  poolLiquidity: BigNumber;
  tradeSize: BigNumber;
  dexType: DexType;
}

export interface ArbitrageRoute {
  path: string[];
  dexes: {
    name: string;
    router: string;
    type: DexType;
    fee?: number;
  }[];
  expectedProfit: BigNumber;
  minAmountOut: BigNumber;
  slippage: number; // Calculado dinámicamente
  minSlippage?: number; // 0.1%
  maxSlippage?: number; // 100%
}