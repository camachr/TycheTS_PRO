// test/testQuoteV3.ts
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);

const USDC = process.env.MAINNET_USDC!;
const WETH = process.env.MAINNET_WETH!;
const QUOTER = process.env.MAINNET_UNISWAP_V3_QUOTER!;
const FEE = parseInt(process.env.UNISWAPV3_FEE_USDC_WETH || '3000');

const ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) view returns (uint256 amountOut)',
];

async function main() {
  const quoter = new ethers.Contract(QUOTER, ABI, provider);

  const amountIn = ethers.utils.parseUnits('1000', 6); // 1000 USDC

  try {
    const amountOut: ethers.BigNumber = await quoter.callStatic.quoteExactInputSingle(
      USDC,
      WETH,
      FEE,
      amountIn,
      0
    );

    console.log(`✅ 1000 USDC → ${ethers.utils.formatEther(amountOut)} WETH`);
  } catch (err) {
    console.error('❌ Error en quoteExactInputSingle:', err);
  }
}

main();
