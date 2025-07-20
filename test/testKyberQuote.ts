// test/testKyberQuote.ts

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const {
  MAINNET_KYBERSWAP_ROUTER,
  MAINNET_USDC,
  MAINNET_WETH,
  ETHEREUM_RPC_URL
} = process.env;

async function main() {
  if (!MAINNET_KYBERSWAP_ROUTER || !MAINNET_USDC || !MAINNET_WETH || !ETHEREUM_RPC_URL) {
    throw new Error('❌ Missing required environment variables');
  }

  const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
  const amountIn = ethers.utils.parseUnits('1', 6); // 1 USDC (6 decimales)

  const kyberSwapRouter = new ethers.Contract(
    MAINNET_KYBERSWAP_ROUTER,
    ['function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'],
    provider
  );

  try {
    const path = [MAINNET_USDC, MAINNET_WETH];
    const amountsOut = await kyberSwapRouter.getAmountsOut(amountIn, path);
    const amountOut = amountsOut[1];

    console.log(`✅ [KyberSwap] Amount out for 1 USDC → WETH: ${ethers.utils.formatEther(amountOut)} WETH`);
  } catch (error) {
    console.error('❌ KyberSwap quote failed:', error);
  }
}

main().catch(console.error);
