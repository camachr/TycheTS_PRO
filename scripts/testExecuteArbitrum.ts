// scripts/testExecuteArbitrum.ts
// This script tests the execute function with a mock arbitrage opportunity on the Arbitrum network.
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
  const network = 'arbitrum' as const;
  const provider = new providers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL!);
  const wallet = new Wallet(process.env.ARBITRUM_PRIVATE_KEY!, provider);
  const contract = await loadFlashloanContract(network, wallet);

  await validateEnvironment(provider, wallet, contract);

  const opportunity: ArbitrageOpportunity = {
    path: ['0x82af49447d8a07e3bd95bd0d56f35241523fbab1', '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'],
    amountIn: ethers.utils.parseEther('1.0'),
    minAmountOut: BigNumber.from('990000'),
    dexes: ['UniswapV3', 'Camelot'],
    estimatedProfit: ethers.utils.parseEther('0.01')
  };

  const result = await execute({ provider, wallet, contract, network }, opportunity);
  console.log('✅ [Arbitrum] Execution result:', result);
}

main().catch(err => {
  console.error('❌ [Arbitrum] Error:', err.message);
  process.exit(1);
});
