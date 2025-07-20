// scripts/gasEstimator.ts

import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { NETWORKS, SupportedNetwork } from "../src/config/networks";
import { loadFlashloanContract } from "../src/utils/contractLoader";
import { normalizeDexKey } from "../src/utils/normalizeDexKey";
import { getAaveLiquidity } from "../src/services/liquidityService";

// Cargar .env desde root
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Configuración de red
const forkUrl = process.env.ANVIL_FORK_URL || "http://127.0.0.1:8546";
const provider = new ethers.providers.JsonRpcProvider(forkUrl);

// Validación NETWORK
function isSupportedNetwork(value: string): value is SupportedNetwork {
  return ["mainnet", "polygon", "arbitrum"].includes(value);
}
const rawNetwork = process.env.NETWORK?.toLowerCase() || "mainnet";
if (!isSupportedNetwork(rawNetwork)) {
  throw new Error(`❌ NETWORK inválida: ${rawNetwork}`);
}
const networkName: SupportedNetwork = rawNetwork;

async function waitForRpc(retries = 10, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      console.log(`⏳ Esperando RPC disponible (${i + 1}/${retries})...`);
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
  throw new Error("❌ RPC no respondió después de varios intentos.");
}

async function main() {
  await waitForRpc();

  const config = NETWORKS[networkName];
  const wallet = ethers.Wallet.createRandom().connect(provider);
  const contract = await loadFlashloanContract(networkName, wallet);

  const loanAsset = process.env.MAINNET_WETH;
  if (!loanAsset) throw new Error("❌ MAINNET_WETH no definido en .env");

  // Obtenemos el liquidity real de Aave
  const aaveLiquidity = await getAaveLiquidity(contract, loanAsset, provider);
  if (aaveLiquidity.amount.isZero()) {
    throw new Error("⚠️ No hay liquidez suficiente para el activo en Aave.");
  }

  const dexes = JSON.parse(process.env.MAINNET_DEXES!);
  const tokens = JSON.parse(process.env.MAINNET_TOKENS!);

  const routers: string[] = dexes.map((dex: string) => {
    const key = normalizeDexKey(dex);
    const address = config.CONTRACT_ADDRESSES[key];
    if (!address) {
      throw new Error(`❌ Dirección no encontrada para ${key} en CONTRACT_ADDRESSES`);
    }
    return address;
  });

  const tokensIn = tokens.map(() => loanAsset);
  const tokensOut = tokens.map((symbol: string) => {
    const address = config.CONTRACT_ADDRESSES[symbol];
    if (!address) {
      throw new Error(`❌ Dirección no encontrada para token ${symbol} en CONTRACT_ADDRESSES`);
    }
    return address;
  });

  const fees = tokens.map(() => 3000);
  const slippageBps = 50;
  const minProfit = ethers.utils.parseUnits("0.01", 18);
  const mevBribe = 0;

  // Estimación de gas bruta
  const estimatedGasUnits = await contract.estimateGas.executeFlashLoanAave(
    loanAsset,
    aaveLiquidity.amount,
    routers,
    tokensIn,
    tokensOut,
    fees,
    slippageBps,
    minProfit,
    mevBribe,
    { value: mevBribe }
  );

  const gasPrice = await provider.getGasPrice();
  const gasCostEth = gasPrice.mul(estimatedGasUnits);
  const gasCostFormatted = ethers.utils.formatEther(gasCostEth);

  console.log(`\n✅ Estimación completa para ${networkName.toUpperCase()}`);
  console.log(`• Gas estimado: ${estimatedGasUnits.toString()} unidades`);
  console.log(`• Gas price actual: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`• Costo estimado: ${gasCostFormatted} ETH\n`);
}

main().catch((err) => {
  console.error("❌ Error en gasEstimator:", err);
  process.exit(1);
});
// Este script estima el costo de gas para una transacción de arbitraje utilizando Aave como fuente de liquidez.
// Asegúrate de tener las variables de entorno adecuadas configuradas en tu .env