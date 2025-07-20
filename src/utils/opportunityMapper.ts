// src/utils/opportunityMapper.ts
import 'dotenv/config';
import { BigNumber } from 'ethers';
import { Opportunity, ArbitrageOpportunity } from '../types';

export function mapToArbitrageOpportunity(opp: Opportunity): ArbitrageOpportunity {
  // Validación exhaustiva de tipos
  if (!opp || typeof opp !== 'object') {
    throw new Error('Invalid opportunity: not an object');
  }

  const requiredProps = ['path', 'amountIn', 'minAmountOut', 'dexes', 'estimatedProfit'];
  const missingProps = requiredProps.filter(prop => !(prop in opp));

  if (missingProps.length > 0) {
    throw new Error(`Missing required properties: ${missingProps.join(', ')}`);
  }

  // Función de conversión segura
  const toBigNumber = (value: BigNumber | string | number): BigNumber => {
    try {
      return value instanceof BigNumber ? value : BigNumber.from(value.toString());
    } catch (error) {
      throw new Error(`Invalid number format: ${value}`);
    }
  };

  return {
    path: opp.path,
    dexes: opp.dexes,
    amountIn: toBigNumber(opp.amountIn),
    minAmountOut: toBigNumber(opp.minAmountOut),
    estimatedProfit: toBigNumber(opp.estimatedProfit)
  };
}