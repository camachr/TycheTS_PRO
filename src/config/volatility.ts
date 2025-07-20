// src/config/volatility.ts
import { SupportedNetwork, NETWORKS } from './networks';
import 'dotenv/config';

export const volatilityData: Record<SupportedNetwork, Record<string, number>> = {
  mainnet: {}
};

const defaults: Record<string, number> = {
  WETH: 0.03,
  USDC: 0.04,
  WBTC: 0.05,
  DAI: 0.03,
  LINK: 0.04,
  UNI: 0.04
};

// Carga segura de tokens
for (const net of Object.keys(volatilityData) as SupportedNetwork[]) {
  const networkConfig = NETWORKS[net];
  
  // Verificar si la configuración de red existe y tiene tokens
  if (!networkConfig || !networkConfig.TOKENS || !Array.isArray(networkConfig.TOKENS)) {
    console.warn(`⚠️ No valid tokens configuration for network: ${net}`);
    continue;
  }

  const tokenSymbols = networkConfig.TOKENS;
  const addresses = networkConfig.CONTRACT_ADDRESSES || {};

  for (const symbol of tokenSymbols) {
    try {
      const addr = addresses[symbol];
      if (!addr) {
        console.warn(`⚠️ No address found for token ${symbol} on ${net}`);
        continue;
      }

      volatilityData[net][addr.toLowerCase()] = defaults[symbol] ?? 0.04;
    } catch (error) {
      console.error(`Error processing token ${symbol} on ${net}:`, error);
    }
  }
}

export function getVolatility(network: SupportedNetwork, tokenAddress: string): number {
  const addr = tokenAddress.toLowerCase();
  
  // Verificar si la red existe en los datos
  if (!volatilityData[network]) {
    throw new Error(`Network ${network} not supported in volatility data`);
  }

  if (volatilityData[network][addr] !== undefined) {
    return volatilityData[network][addr];
  }
  
  // Si no encontramos el token, usar un valor por defecto seguro en lugar de lanzar error
  console.warn(`Volatility data not found for ${network} and token ${tokenAddress}, using default 0.04`);
  return 0.04;
}