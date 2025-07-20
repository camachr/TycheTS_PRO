// test/testQuoteV2.ts
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const USDC = process.env.MAINNET_USDC!;
const WETH = process.env.MAINNET_WETH!;
const UNISWAP_V2_ROUTER = process.env.MAINNET_UNISWAP_V2_ROUTER!;
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL!;

const ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
  const router = new ethers.Contract(UNISWAP_V2_ROUTER, ABI, provider);

  const amountIn = ethers.utils.parseUnits('1000', 6); // 1000 USDC

  // 🟢 Aseguramos que las direcciones tengan checksum correcto
  const path = [ethers.utils.getAddress(USDC), ethers.utils.getAddress(WETH)];

  try {
    const amountsOut = await router.getAmountsOut(amountIn, path);
    console.log(`✅ ${ethers.utils.formatUnits(amountIn, 6)} USDC → ${ethers.utils.formatEther(amountsOut[1])} WETH`);
  } catch (error) {
    console.error('❌ Error in getAmountsOut:', error);
  }
}

main();
