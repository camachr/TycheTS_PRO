// src/utils/validateOpportunity.ts

import { BigNumber } from 'ethers';
import type { ArbitrageOpportunity } from '../types';
import 'dotenv/config';

export function validateOpportunity(opp: ArbitrageOpportunity): boolean {
  if (!opp) return false;

  // Validar path
  if (!Array.isArray(opp.path) || opp.path.length < 2) return false;

  // Validar amountIn
  if (!opp.amountIn || BigNumber.from(opp.amountIn).lte(0)) return false;

  // Validar minAmountOut
  if (!opp.minAmountOut || BigNumber.from(opp.minAmountOut).lte(0)) return false;

  // Validar dexes
  if (!Array.isArray(opp.dexes) || opp.dexes.length < 2) return false;

  // Validar estimatedProfit
  if (!opp.estimatedProfit || BigNumber.from(opp.estimatedProfit).lte(0)) return false;

  return true;
}
