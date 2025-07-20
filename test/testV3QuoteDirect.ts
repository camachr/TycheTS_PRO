import { ethers } from 'ethers';
import { getV3Quote } from '../src/services/v3QuoteService';
import { NETWORKS } from '../src/config/networks';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const main = async () => {
  const network = process.env.DEFAULT_NETWORK || 'mainnet';
  const config = NETWORKS[network];
  if (!config) throw new Error(`Red no soportada: ${network}`);

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const tokenIn = config.tokens.USDC.address;
  const tokenOut = config.tokens.WETH.address;
  const fee = 3000;
  const decimals = config.tokens.USDC.decimals;
  const amountIn = ethers.BigNumber.from(10).pow(decimals).mul(1000); // 1000 USDC

  const amountOut = await getV3Quote(provider, tokenIn, tokenOut, amountIn.toString(), fee, network);

  console.log(`✅ ${ethers.utils.formatUnits(amountIn, decimals)} ${config.tokens.USDC.symbol} → ${ethers.utils.formatEther(amountOut)} ${config.tokens.WETH.symbol}`);
};

main();
