// src/utils/envValidator.ts
import dotenv from 'dotenv';
import path from 'path';
import { Logger } from '../utils/logger';
import { SupportedNetwork, isSupportedNetwork } from '../config/networks';
import 'dotenv/config';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const CORE_VARS = {
  required: {
    global: [
      'RPC_URL', 'PRIVATE_KEY', 'FLASHLOAN_CONTRACT',
      'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'
    ],
    network: {
      mainnet: ['MAINNET_TOKENS', 'MAINNET_DEXES', 'MAINNET_WETH'],
      polygon: ['POLYGON_TOKENS', 'POLYGON_DEXES', 'POLYGON_WETH'],
      arbitrum: ['ARBITRUM_TOKENS', 'ARBITRUM_DEXES', 'ARBITRUM_WETH']
    }
  },
  optional: {
    GAS_BUFFER: '1.2',
    MAX_RETRIES: '3',
    FLASHBOTS_RETRY_BLOCKS: '3',
    PROFIT_THRESHOLD_MULTIPLIER: '1.3'
  }
};

export function validateEnv(network?: SupportedNetwork): void {
  Logger.info('🔍 Validating environment configuration...');

  let errorCount = 0;
  const currentNetwork: SupportedNetwork = network || (process.env.NETWORK as SupportedNetwork) || 'mainnet';

  // 1. Validar red soportada
  if (!isSupportedNetwork(currentNetwork)) {
    Logger.fatal(`❌ Unsupported network: ${currentNetwork}`);
    process.exit(1);
  }

  // 2. Validar variables globales
  for (const key of CORE_VARS.required.global) {
    const value = process.env[key];
    if (!value) {
      Logger.error(`❌ Missing required env var: ${key}`);
      errorCount++;
      continue;
    }

    if (key === 'RPC_URL' && !isValidUrl(value)) {
      Logger.error(`❌ Invalid URL format for RPC_URL`);
      errorCount++;
    }

    if (key === 'PRIVATE_KEY' && !isValidPrivateKey(value)) {
      Logger.error(`❌ Invalid PRIVATE_KEY format (64 hex chars with/without 0x)`);
      errorCount++;
    }

    if (key === 'FLASHLOAN_CONTRACT' && !isValidEthAddress(value)) {
      Logger.error(`❌ Invalid FLASHLOAN_CONTRACT address format`);
      errorCount++;
    }
  }

  // 3. Validar variables de red específicas
  for (const key of CORE_VARS.required.network[currentNetwork]) {
    const value = process.env[key];
    if (!value) {
      Logger.error(`❌ Missing network var: ${key}`);
      errorCount++;
      continue;
    }

    if ((key.includes('TOKENS') || key.includes('DEXES')) && !validateJsonArray(value)) {
      Logger.error(`❌ ${key} must be a valid non-empty JSON array`);
      errorCount++;
      continue;
    }

    // Validación extra: tokens deben ser símbolos válidos (solo letras mayúsculas/números, 2-10 chars)
    if (key.includes('TOKENS')) {
      try {
  const parsedValue = JSON.parse(value);
  
  if (!parsedValue || !Array.isArray(parsedValue)) {
    throw new Error(`Expected array, got ${typeof parsedValue}`);
  }

  const tokens = parsedValue as string[];
  const invalidTokens = tokens.filter(t => !t || typeof t !== 'string' || !/^[A-Z0-9]{2,10}$/.test(t));

  if (invalidTokens.length > 0) {
    Logger.error(`❌ ${invalidTokens.length} invalid token(s) in ${key}: ${invalidTokens.join(', ')}`);
    errorCount++;
  }
} catch (error) {
  Logger.error(`❌ ${key} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  errorCount++;
}
    }
  }

  // 4. Validar y asignar opcionales
  for (const [key, defaultValue] of Object.entries(CORE_VARS.optional)) {
    const value = process.env[key];
    if (value && !isValidNumber(value)) {
      Logger.error(`❌ ${key} must be a valid number`);
      errorCount++;
    }
    if (!value) {
      Logger.warn(`⚠️ Using default for ${key}: ${defaultValue}`);
      process.env[key] = defaultValue;
    }
  }

  if (errorCount > 0) {
    Logger.fatal(`💥 Failed with ${errorCount} configuration errors`);
    process.exit(1);
  }

  Logger.success('✅ Environment validation passed');
  logCurrentConfig(currentNetwork);
}

// Helper functions

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidPrivateKey(pk: string): boolean {
  return /^(0x)?[0-9a-fA-F]{64}$/.test(pk);
}

function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateJsonArray(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function isValidNumber(value: string): boolean {
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

function logCurrentConfig(network: SupportedNetwork): void {
  if (process.env.DEBUG === 'true') {
    const net = network.toUpperCase();
    const tokensEnv = process.env[`${net}_TOKENS`] || '';
    Logger.debug(
      'Current environment configuration: ' +
      JSON.stringify({
        network: net,
        rpc: process.env.RPC_URL?.substring(0, 25) + '...',
        contract: process.env.FLASHLOAN_CONTRACT,
        tokens: tokensEnv.substring(0, 50) + '...'
      })
    );
  }
}

// EXTRA: Validación de saldo mínimo antes de lanzar el bot (para integrar en runner si se desea)
import { ethers } from 'ethers';
export async function validateWalletBalance(provider: ethers.providers.Provider, wallet: ethers.Wallet, minEth = '0.1'): Promise<boolean> {
  try {
    const balance = await provider.getBalance(wallet.address);
    const required = ethers.utils.parseEther(minEth);
    if (balance.lt(required)) {
      Logger.fatal(`❌ Wallet balance too low: ${ethers.utils.formatEther(balance)} ETH < ${minEth} ETH required`);
      return false;
    }
    Logger.success(`💰 Wallet balance sufficient: ${ethers.utils.formatEther(balance)} ETH`);
    return true;
  } catch (error) {
    Logger.fatal(`💥 Failed to validate wallet balance: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
