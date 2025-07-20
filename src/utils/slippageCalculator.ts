// src/utils/slippageCalculator.ts
import 'dotenv/config';
import { BigNumber } from 'ethers';
import { DexType } from '../types';

export function calculateDynamicSlippage(params: {
  volatility: number;
  poolLiquidity: BigNumber;
  tradeSize: BigNumber;
  dexType: DexType;
}): number {
  // 1. Validación de inputs para prevenir underflow
  if (params.poolLiquidity.isZero()) {
    return 100; // 100% slippage si no hay liquidez
  }

  // 2. Slippage base con valores seguros
  const BASE_SLIPPAGES = {
    V2: 0.5,
    V3: 0.3,
    CURVE: 0.2,
    BALANCER: 0.4
  };

  let baseSlippage = BASE_SLIPPAGES[params.dexType] || 0.5;

  // 3. Cálculo seguro de liquidityRatio
  const liquidityRatio = params.tradeSize.mul(10000).div(params.poolLiquidity).toNumber() / 10000;
  const liquidityFactor = Math.min(1, Math.max(0.01, liquidityRatio * 10)); // Limites 0.01-1

  // 4. Ajuste por volatilidad con límites
  const safeVolatility = Math.min(1, Math.max(0, params.volatility));
  const volatilityFactor = 1 + (safeVolatility * 2); // 1-3x

  // 5. Fórmula final con protección numérica
  return Math.min(
    100, // Máximo 100%
    Math.max(
      0.1, // Mínimo 0.1%
      baseSlippage * liquidityFactor * volatilityFactor
    )
  );
}
