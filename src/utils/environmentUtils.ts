//src/utils/environmentUtils.ts
import 'dotenv/config';
import { ethers, Wallet } from 'ethers';
import { NETWORKS, SupportedNetwork } from '../config/networks';

/**
 * Prepara el entorno del bot: provider, wallet, y config de red.
 */
export function initializeBotEnvironment(network: SupportedNetwork) {
  const config = NETWORKS[network]; // ✅ acceso correcto
  const provider = new ethers.providers.JsonRpcProvider(config.HTTP_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY as string, provider);
  return { config, provider, wallet };
}
