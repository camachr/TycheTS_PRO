// src/config/networks.ts
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { TokenInfo, DexRouter, DexType } from '../types';
import 'dotenv/config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export type SupportedNetwork = 'mainnet';

export const isSupportedNetwork = (value: string): value is SupportedNetwork =>
  value === 'mainnet';

const rawNetwork = process.env.NETWORK?.toLowerCase() || 'mainnet';
if (!isSupportedNetwork(rawNetwork)) {
  throw new Error(`❌ Red no soportada: ${rawNetwork}`);
}
const NETWORK: SupportedNetwork = rawNetwork;

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`❌ Falta variable de entorno: ${key}`);
  return value;
};

interface NetworkConfig {
  CHAIN_ID: number;
  WS_URL: string;
  HTTP_URL: string;
  FLASHBOTS_RPC?: string;
  CHAINLINK_ETH_USD: string;
  CONTRACT_ADDRESSES: Record<string, string>;
  DEXES: string[];
  TOKENS: string[];
}

const mainnetConfig: NetworkConfig = {
  CHAIN_ID: 1,
  WS_URL: getEnv('ETHEREUM_WS_URL'),
  HTTP_URL: getEnv('ETHEREUM_RPC_URL'),
  FLASHBOTS_RPC: getEnv('MAINNET_FLASHBOTS_RPC'),
  CHAINLINK_ETH_USD: getEnv('MAINNET_CHAINLINK_ETH_USD'),
  CONTRACT_ADDRESSES: {
    FLASHLOAN_CONTRACT: getEnv('MAINNET_FLASHLOAN_CONTRACT'),
    WETH: getEnv('MAINNET_WETH'),
    AAVE_LENDING_POOL: getEnv('MAINNET_AAVE_LENDING_POOL'),
    UNISWAP_ROUTER: getEnv('MAINNET_UNISWAP_ROUTER'),
    UNISWAP_V2_ROUTER: getEnv('MAINNET_UNISWAPV2_ROUTER'),
    UNISWAP_V3_ROUTER: getEnv('MAINNET_UNISWAP_V3_ROUTER'),
    SUSHISWAP_ROUTER: getEnv('MAINNET_SUSHISWAP_ROUTER'),
    CURVE: getEnv('MAINNET_CURVE'),
    BALANCER: getEnv('MAINNET_BALANCER'),
    DODO: getEnv('MAINNET_DODO'),
    WBTC: getEnv('MAINNET_WBTC'),
    LINK: getEnv('MAINNET_LINK'),
    DAI: getEnv('MAINNET_DAI'),
    USDC: getEnv('MAINNET_USDC'),
    UNI: getEnv('MAINNET_UNI'),
    CURVE_ROUTER: getEnv('MAINNET_CURVE_ROUTER'),
    BALANCER_ROUTER: getEnv('MAINNET_BALANCER_ROUTER'),
    DODO_ROUTER: getEnv('MAINNET_DODO_ROUTER'),
  },
  DEXES: JSON.parse(getEnv('ETHEREUM_DEXES')),
  TOKENS: JSON.parse(getEnv('ETHEREUM_TOKENS')),
};

/*function getPolygonConfig(): NetworkConfig {
  if (NETWORK !== 'polygon') throw new Error('⛔ POLYGON config no está habilitada en este entorno');
  return {
    CHAIN_ID: 137,
    WS_URL: getEnv('POLYGON_WS_URL'),
    HTTP_URL: getEnv('POLYGON_RPC_URL'),
    CHAINLINK_ETH_USD: getEnv('POLYGON_CHAINLINK_ETH_USD'),
    CONTRACT_ADDRESSES: {
      FLASHLOAN_CONTRACT: getEnv('POLYGON_FLASHLOAN_CONTRACT'),
      WETH: getEnv('POLYGON_WETH'),
      AAVE_LENDING_POOL: getEnv('POLYGON_AAVE_LENDING_POOL'),
      UNISWAP_ROUTER: getEnv('POLYGON_UNISWAP_ROUTER'),
      SUSHISWAP_ROUTER: getEnv('POLYGON_SUSHISWAP_ROUTER'),
      CURVE: getEnv('POLYGON_CURVE'),
      BALANCER: getEnv('POLYGON_BALANCER'),
      KYBERSWAP: getEnv('POLYGON_KYBERSWAP'),
      DODO: getEnv('POLYGON_DODO'),
      WBTC: getEnv('POLYGON_WBTC'),
      LINK: getEnv('POLYGON_LINK'),
      DAI: getEnv('POLYGON_DAI'),
      USDC: getEnv('POLYGON_USDC'),
      WMATIC: getEnv('POLYGON_WMATIC'),
    },
    DEXES: JSON.parse(getEnv('POLYGON_DEXES')),
    TOKENS: JSON.parse(getEnv('POLYGON_TOKENS')),
  };
}

function getArbitrumConfig(): NetworkConfig {
  if (NETWORK !== 'arbitrum') throw new Error('⛔ ARBITRUM config no está habilitada en este entorno');
  return {
    CHAIN_ID: 42161,
    WS_URL: getEnv('ARBITRUM_WS_URL'),
    HTTP_URL: getEnv('ARBITRUM_RPC_URL'),
    CHAINLINK_ETH_USD: getEnv('ARBITRUM_CHAINLINK_ETH_USD'),
    CONTRACT_ADDRESSES: {
      FLASHLOAN_CONTRACT: getEnv('ARBITRUM_FLASHLOAN_CONTRACT'),
      WETH: getEnv('ARBITRUM_WETH'),
      AAVE_LENDING_POOL: getEnv('ARBITRUM_AAVE_LENDING_POOL'),
      UNISWAP_ROUTER: getEnv('ARBITRUM_UNISWAP_ROUTER'),
      SUSHISWAP_ROUTER: getEnv('ARBITRUM_SUSHISWAP_ROUTER'),
      CURVE: getEnv('ARBITRUM_CURVE'),
      BALANCER: getEnv('ARBITRUM_BALANCER'),
      KYBERSWAP: getEnv('ARBITRUM_KYBERSWAP'),
      DODO: getEnv('ARBITRUM_DODO'),
      WBTC: getEnv('ARBITRUM_WBTC'),
      LINK: getEnv('ARBITRUM_LINK'),
      DAI: getEnv('ARBITRUM_DAI'),
      USDC: getEnv('ARBITRUM_USDC'),
    },
    DEXES: JSON.parse(getEnv('ARBITRUM_DEXES')),
    TOKENS: JSON.parse(getEnv('ARBITRUM_TOKENS')),
  };
}*/

export const NETWORKS: Record<SupportedNetwork, NetworkConfig> = {
  mainnet: mainnetConfig,
  };

export async function initializeNetworkComponents(network: SupportedNetwork) {
   if (network !== 'mainnet') {
    throw new Error('Only mainnet is supported');
   }const config = NETWORKS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.HTTP_URL);

  const dexes = config.DEXES.map(name => ({
    name,
    router: config.CONTRACT_ADDRESSES[`${name.toUpperCase()}_ROUTER`],
    type: name.includes('V3') ? 'V3' : 'V2',
  }));

  const tokens: Record<string, { symbol: string; address: string; decimals: number }> = {};

  for (const symbol of config.TOKENS) {
    const address = config.CONTRACT_ADDRESSES[symbol];
    tokens[symbol] = {
      symbol,
      address,
      decimals: symbol === 'USDC' ? 6 : 18,
    };
  }

  const contractAddress = config.CONTRACT_ADDRESSES.FLASHLOAN_CONTRACT;

  return { provider, dexes, tokens, contractAddress };
}

export const getTokenConfig = (network: SupportedNetwork, symbol: string): TokenInfo => {
  const config = NETWORKS[network];
  const address = config.CONTRACT_ADDRESSES[symbol];

  if (!address) throw new Error(`Token ${symbol} not configured for ${network}`);

  return {
    address,
    symbol,
    decimals: symbol === 'USDC' ? 6 : 18,
  };
};

export const getDexConfig = (network: SupportedNetwork, name: string): DexRouter => {
  const config = NETWORKS[network];
  const router = config.CONTRACT_ADDRESSES[`${name.toUpperCase()}_ROUTER`];

  return {
    name,
    router,
    type: name.includes('V3') ? 'V3' : ('V2' as DexType),
  };
};
