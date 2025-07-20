// src/config/dexRegistry.ts
import 'dotenv/config';
import { DexType } from '../types';

export const dexRegistry: Record<
  string,
  { type: DexType; address: string; fee?: number; network?: string }
> = {
  UNISWAP_V2: {
    type: 'V2',
    address: process.env.MAINNET_UNISWAP_V2_ROUTER!,
  },
  UNISWAP_V3: {
    type: 'V3',
    address: process.env.MAINNET_UNISWAP_V3_QUOTER!,
    fee: 3000, // Example fee tier for Uniswap V3 (adjust as needed)
    network: 'mainnet', // Add the network property
  },
  BALANCER: {
    type: 'BALANCER',
    address: process.env.MAINNET_BALANCER_VAULT!,
  },
  CURVE: {
    type: 'CURVE',
    address: process.env.MAINNET_CURVE_ROUTER!, // si aplica
  },
  // Puedes añadir más DEX aquí siguiendo el mismo formato
};