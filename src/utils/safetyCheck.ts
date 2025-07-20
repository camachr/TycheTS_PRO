// src/utils/safetyCheck.ts

import { Contract, providers, Wallet, ethers } from 'ethers';
import 'dotenv/config';
export async function validateEnvironment(
  provider: providers.JsonRpcProvider,
  wallet: Wallet,
  contract: Contract,
  minEthBalance = ethers.utils.parseEther('0.05')
): Promise<void> {
  try {
    // Añadir chequeo de conexión más robusto
    await Promise.race([
      provider.getBlockNumber(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Provider timeout')), 3000)
      )
    ]);
  } catch (err) {
    throw new Error(`❌ Provider not reachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Validar balance con margen de seguridad
  const balance = await wallet.getBalance();
  if (balance.lt(minEthBalance.mul(2))) { // Doble margen de seguridad
    throw new Error(`❌ Insufficient ETH balance: ${ethers.utils.formatEther(balance)} ETH (Min required: ${ethers.utils.formatEther(minEthBalance.mul(2))})`);
  }

  // Validar contrato con chequeo de funciones básicas
  try {
    await Promise.all([
      contract.deployed(),
      contract.provider.getCode(contract.address).then(code => {
        if (code === '0x') throw new Error('No contract code');
      })
    ]);
  } catch {
    throw new Error('❌ Contract not deployed or unreachable');
  }
}