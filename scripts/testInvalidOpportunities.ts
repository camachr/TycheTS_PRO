// scripts/testInvalidOpportunities.ts

import { BigNumber } from 'ethers';
import { validateOpportunity } from '../src/utils/validateOpportunity';
import type { ArbitrageOpportunity } from '../src/types';

const invalidOpportunities: ArbitrageOpportunity[] = [
  {
    path: [],
    amountIn: BigNumber.from(0),
    minAmountOut: BigNumber.from(0),
    dexes: [],
    estimatedProfit: BigNumber.from(0),
  },
  {
    path: ['0xTokenA'],
    amountIn: BigNumber.from(1000),
    minAmountOut: BigNumber.from(0),
    dexes: ['0xDex1'],
    estimatedProfit: BigNumber.from(10),
  },
  {
    path: ['0xTokenA', '0xTokenB'],
    amountIn: BigNumber.from(1000),
    minAmountOut: BigNumber.from(900),
    dexes: ['0xDex1'],
    estimatedProfit: BigNumber.from(50),
  }
];

for (const [i, opp] of invalidOpportunities.entries()) {
  const valid = validateOpportunity(opp);
  console.log(`[TEST ${i + 1}] opportunity valid: ${valid}`);
  if (valid) {
    throw new Error(`❌ Test ${i + 1} falló. Oportunidad inválida fue aceptada:\n${JSON.stringify(opp, null, 2)}`);
  } else {
    console.log(`✅ Test ${i + 1} pasó. Oportunidad correctamente rechazada.`);
  }
}
