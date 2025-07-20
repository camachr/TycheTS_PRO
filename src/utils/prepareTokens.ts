// src/utils/prepareTokens.ts
import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';
import { SupportedNetwork } from '../types';
import { NETWORKS } from '../config/networks';
import 'dotenv/config';
export const getTokenDecimals = (tokenSymbol: string): number => {
  const token = NETWORKS.mainnet.CONTRACT_ADDRESSES[tokenSymbol];  // Accedemos a través de NETWORKS
  if (!token) throw new Error(`Unsupported token: ${tokenSymbol}`);
  return tokenSymbol === 'USDC' ? 6 : 18;  // Asumimos misma lógica de decimales
};

export const getMinTradeSize = (tokenSymbol: string): string => {
  // Como minTrade no está en NETWORKS, podemos manejarlo de otra forma
  // Por ejemplo, usando valores por defecto o variables de entorno
  const defaultMinTrades: Record<string, string> = {
    WETH: '0.01',
    WBTC: '0.0001',
    USDC: '10',
    DAI: '10',
    LINK: '1'
  };
  
  if (!defaultMinTrades[tokenSymbol]) {
    throw new Error(`Unsupported token: ${tokenSymbol}`);
  }
  return defaultMinTrades[tokenSymbol];
};

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

interface TokenInfo {
  address: string;
  decimals: number;
  symbol: string;
}

export function prepareTokens(network: SupportedNetwork): TokenInfo[] {
  if (network !== 'mainnet') {
    throw new Error('Token preparation only supported for mainnet');
  }
   const tokenSymbols = JSON.parse(process.env['MAINNET_TOKENS'] || '[]');

  return tokenSymbols
    .map((symbol: string): TokenInfo | null => {
      const address = process.env[`MAINNET_${symbol}`];
      if (!address || !ethers.utils.isAddress(address)) {
        console.warn(`⚠️ Invalid address for token ${symbol}`);
        return null;
      }
      
      const decimals = symbol === 'USDC' || symbol === 'DAI' ? 6 : 18;
      return { address, symbol, decimals };
    })
    .filter((token: TokenInfo | null): token is TokenInfo => token !== null);
}

export const validateTokenPair = (tokenIn: string, tokenOut: string): void => {
  if (!ethers.utils.isAddress(tokenIn)) throw new Error(`Invalid tokenIn: ${tokenIn}`);
  if (!ethers.utils.isAddress(tokenOut)) throw new Error(`Invalid tokenOut: ${tokenOut}`);
  if (tokenIn === tokenOut) throw new Error('Cannot quote same token');
};