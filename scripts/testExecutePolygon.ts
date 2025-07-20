// scripts/testExecutePolygon.ts
// This script tests the execute function with a mock arbitrage opportunity on the Polygon network.
// It assumes you have a valid RPC URL and private key in your .env file.

import { ethers, BigNumber, providers, Wallet } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { loadFlashloanContract } from '../src/utils/contractLoader';
import { execute } from '../src/executor';
import { ArbitrageOpportunity } from '../src/types';
import { validateEnvironment } from '../src/utils/safetyCheck';

async function main() {
  const network = 'polygon' as const;
  const provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL!);
  const wallet = new Wallet(process.env.POLYGON_PRIVATE_KEY!, provider);
  const contract = await loadFlashloanContract(network, wallet);

  await validateEnvironment(provider, wallet, contract);

  const opportunity: ArbitrageOpportunity = {
    path: ['0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
    amountIn: ethers.utils.parseEther('1.0'),
    minAmountOut: BigNumber.from('990000'),
    dexes: ['QuickSwap', 'SushiSwap'],
    estimatedProfit: ethers.utils.parseEther('0.01')
  };

  const result = await execute({ provider, wallet, contract, network }, opportunity);
  console.log('✅ [Polygon] Execution result:', result);
}

main().catch(err => {
  console.error('❌ [Polygon] Error:', err.message);
  process.exit(1);
});
