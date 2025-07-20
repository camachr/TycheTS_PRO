// test/testDexQuote.ts
import { ethers, BigNumber } from 'ethers';
import { getPriceQuote, DexType } from '../src/services/dexService';
import dotenv from 'dotenv';
import path from 'path';
import 'dotenv/config';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// 🔧 Definimos todo explícitamente para evitar errores con estructuras abstractas
const network = 'mainnet' as const;
const dexName = 'UniswapV2';
const dexType: DexType = 'V2';

const USDC = process.env.MAINNET_USDC!;
const WETH = process.env.MAINNET_WETH!;
const ROUTER = process.env.MAINNET_UNISWAP_V2_ROUTER!;
const RPC_URL = process.env.ETHEREUM_RPC_URL!;

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const tokenIn = ethers.utils.getAddress(USDC);
  const tokenOut = ethers.utils.getAddress(WETH);
  const amount = BigNumber.from(10).pow(6).mul(1000); // 1000 USDC

  try {
    const result = await getPriceQuote(
      ROUTER,
      tokenIn,
      tokenOut,
      amount,
      provider,
      network,
      dexType
    );

    if (result?.amountOut) {
      console.log(`✅ ${ethers.utils.formatUnits(amount, 6)} USDC → ${ethers.utils.formatEther(result.amountOut)} WETH`);
    } else {
      console.log(`❌ Quote fallido`);
    }
  } catch (err) {
    console.error('❌ Error al obtener el quote:', err);
  }
};

main();
