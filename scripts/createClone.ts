// scripts/createClone.ts

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { execSync } from "child_process";
dotenv.config();

async function main() {
  const rpcUrl = process.env.ETHEREUM_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const factoryAddress = process.env.MAINNET_FACTORY_CONTRACT;
  const routerV2 = process.env.MAINNET_UNISWAP_ROUTER;
  const routerV3 = process.env.MAINNET_UNISWAPV3_ROUTER;
  const deployerWallet = process.env.DEPLOYER_ADDRESS;

  if (!rpcUrl || !privateKey || !factoryAddress || !routerV2 || !routerV3 || !deployerWallet) {
    throw new Error("❌ Faltan variables en .env. Verifica ETHEREUM_RPC_URL, PRIVATE_KEY, MAINNET_FACTORY_CONTRACT, etc.");
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const factoryAbi = [
    "function createClone(address admin, address[] routersV2, address[] routersV3) returns (address)",
    "event CloneCreated(address indexed clone, address indexed admin)"
  ];

  const factory = new ethers.Contract(factoryAddress, factoryAbi, wallet);

  console.log("📍 Estimando dirección del clon...");
  let predictedClone: string = "";
  try {
    predictedClone = await factory.callStatic.createClone(
      deployerWallet,
      [routerV2],
      [routerV3]
    );
    console.log(`📎 Dirección estimada del clon: ${predictedClone}`);
  } catch (err) {
    console.warn("⚠️ No se pudo predecir la dirección del clon:", err);
  }

  console.log("🚀 Ejecutando createClone...");
  const tx = await factory.createClone(
    deployerWallet,
    [routerV2],
    [routerV3]
  );
  console.log(`📤 Transacción enviada: ${tx.hash}`);

  const receipt = await tx.wait();
  const gasUsed = receipt.gasUsed;
  const gasPrice = tx.gasPrice ?? receipt.effectiveGasPrice;
  const totalCostEth = ethers.utils.formatEther(gasUsed.mul(gasPrice));

  let cloneAddress = predictedClone;

  const event = receipt.events?.find((e: any) => e.event === "CloneCreated");
  if (event && event.args?.clone) {
    cloneAddress = event.args.clone;
    console.log(`✅ Evento CloneCreated detectado: ${cloneAddress}`);
  } else {
    console.warn("⚠️ No se encontró el evento CloneCreated. Usando dirección predicha.");
  }

  console.log(`✅ Clone creado en: ${cloneAddress}`);
  console.log(`⛽ Gas usado: ${gasUsed.toString()}`);
  console.log(`💰 Costo estimado: ${totalCostEth} ETH`);
  console.log(`📦 Bloque: ${receipt.blockNumber}`);

  // 🔐 Dar permisos al script .sh
  try {
    execSync("chmod +x ./scripts/setNewClone.sh");
  } catch (err) {
    console.error("⚠️ Error al dar permisos de ejecución a setNewClone.sh:", err);
    process.exit(1);
  }

  // 🧠 Ejecutar script para actualizar variables en .env
  try {
    execSync(`./scripts/setNewClone.sh ${cloneAddress}`, { stdio: "inherit" });
  } catch (err) {
    console.error("❌ Error al ejecutar setNewClone.sh:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
