// scripts/grantRole.ts

import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const rpcUrl = process.env.ETHEREUM_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.MAINNET_FLASHLOAN_CONTRACT;
  const deployerAddress = process.env.DEPLOYER_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress || !deployerAddress) {
    throw new Error("❌ Faltan variables en .env");
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const contractAbi = [
    "function hasRole(bytes32,address) view returns (bool)",
    "function getRoleAdmin(bytes32) view returns (bytes32)",
    "function grantRole(bytes32,address)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)"
  ];

  const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

  // Obtener el rol de administrador por defecto
  const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
  const EXECUTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE"));

  // Verificar si nuestra cuenta tiene el rol de administrador
  const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, wallet.address);
  console.log(`🔑 ${wallet.address} tiene DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);

  if (!hasAdminRole) {
    // Verificar quién es el administrador
    const adminRoleAdmin = await contract.getRoleAdmin(DEFAULT_ADMIN_ROLE);
    console.log(`🛡️  Admin de DEFAULT_ADMIN_ROLE: ${adminRoleAdmin}`);
    
    const executorRoleAdmin = await contract.getRoleAdmin(EXECUTOR_ROLE);
    console.log(`🛡️  Admin de EXECUTOR_ROLE: ${executorRoleAdmin}`);
    
    throw new Error("❌ La cuenta no tiene permisos para otorgar roles");
  }

  // Verificar si el deployer ya tiene el rol
  const hasRole = await contract.hasRole(EXECUTOR_ROLE, deployerAddress);
  console.log(`🔄 ${deployerAddress} tiene EXECUTOR_ROLE: ${hasRole}`);

  if (hasRole) {
    console.log("✅ El deployer ya tiene el rol asignado");
    return;
  }

  // Otorgar el rol
  console.log("🔧 Otorgando EXECUTOR_ROLE...");
  const tx = await contract.grantRole(EXECUTOR_ROLE, deployerAddress);
  console.log(`📤 Transacción enviada: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✅ Rol otorgado en bloque: ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});