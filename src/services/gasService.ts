// src/services/gasService.ts
import { BigNumber, PopulatedTransaction, providers, Wallet, ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { Logger } from '../utils/logger';
import { SupportedNetwork } from '../config/networks';
import { Mutex } from 'async-mutex';
import 'dotenv/config';

// CONFIGURACIÓN CENTRALIZADA
const CACHE_TTL_MS = 5000;
const SIMULATION_TIMEOUT_MS = 10000;
const MAX_GAS_MULTIPLIER = 10_000;

type StrategyType = 'aggressive' | 'balanced' | 'conservative';

interface GasOptions {
  network: SupportedNetwork;
  strategy?: StrategyType;
  simulate?: boolean;
  flashbotsProvider?: FlashbotsBundleProvider;
  wallet?: Wallet;
  simulationStrict?: boolean;
  forceRefreshCache?: boolean;
  dynamicSlippage?: boolean;  // Nueva propiedad
  volatilityData?: Record<string, number>;  // Nueva propiedad
}

export interface GasEstimates {
  gasLimit: BigNumber;
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
  simulationSuccess: boolean;
  estimatedGasCost: BigNumber;
  isSimulationCriticalFailure?: boolean;
}

const STRATEGY_MULTIPLIERS: Record<StrategyType, { gasBuffer: number; feeMultiplier: number; priorityMultiplier: number }> = {
  aggressive:    { gasBuffer: 100, feeMultiplier: 200, priorityMultiplier: 200 },
  balanced:      { gasBuffer: 125, feeMultiplier: 100, priorityMultiplier: 100 },
  conservative:  { gasBuffer: 150, feeMultiplier: 80,  priorityMultiplier: 70 }
};

const FALLBACK_VALUES: Record<SupportedNetwork, {
  gasLimit: BigNumber;
  maxFee: BigNumber;
  priorityFee: BigNumber;
}> = {
  mainnet:  { gasLimit: BigNumber.from(1_500_000), maxFee: BigNumber.from('10000000000'), priorityFee: BigNumber.from('500000000') },
  // polygon:  { gasLimit: BigNumber.from(2_000_000), maxFee: BigNumber.from('500000000000'), priorityFee: BigNumber.from('30000000000') },
  // arbitrum: { gasLimit: BigNumber.from(10_000_000), maxFee: BigNumber.from('1000000000'), priorityFee: BigNumber.from('500000000') }
};

const cacheMutex = new Mutex();
let feeDataCache: { data: providers.FeeData; timestamp: number; chainId: number } | null = null;

// Funciones auxiliares declaradas primero
function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeMultiply(a: BigNumber, b: number): BigNumber {
  if (b <= 0 || b > MAX_GAS_MULTIPLIER) {
    throw new Error(`[SAFE_MULTIPLY] Invalid multiplier: ${b}`);
  }
  return a.mul(BigNumber.from(b));
}

function isValidFeeData(data: providers.FeeData): boolean {
  return !!data && !!data.maxFeePerGas && !!data.maxPriorityFeePerGas;
}

function isCriticalError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('revert') ||
         msg.includes('execution reverted') ||
         msg.includes('invalid opcode') ||
         msg.includes('insufficient') ||
         msg.includes('invalid jump') ||
         msg.includes('gas required exceeds allowance');
}

async function getCachedFeeData(
  provider: providers.JsonRpcProvider,
  network: SupportedNetwork,
  force: boolean = false
): Promise<providers.FeeData> {
  return await cacheMutex.runExclusive(async () => {
    const now = Date.now();
    const chain = await provider.getNetwork();

    if (!force && feeDataCache && now - feeDataCache.timestamp < CACHE_TTL_MS && feeDataCache.chainId === chain.chainId) {
      Logger.debug('[CACHE] Using cached fee data');
      return feeDataCache.data;
    }

    try {
      const data = await provider.getFeeData();
      feeDataCache = { data, timestamp: now, chainId: chain.chainId };
      Logger.debug('[CACHE] Fetched fresh fee data');
      return data;
    } catch (error) {
      Logger.warn(`[CACHE] Failed fetching fee data: ${extractErrorMessage(error)}. Using hard fallback`);
      return {
        maxFeePerGas: FALLBACK_VALUES[network].maxFee,
        maxPriorityFeePerGas: FALLBACK_VALUES[network].priorityFee,
        gasPrice: null,
        lastBaseFeePerGas: null
      } as providers.FeeData;
    }
  });
}

/**
 * Calculates optimal gas parameters with simulation and network-specific fallbacks
 */
export async function estimateOptimalGas(
  tx: PopulatedTransaction,
  provider: providers.JsonRpcProvider,
  options: GasOptions
): Promise<GasEstimates> {
  const strategy = options.strategy || 'balanced';

  const multipliers = STRATEGY_MULTIPLIERS[strategy];
  let simulationSuccess = true;
  let isSimulationCriticalFailure = false;
  if (!tx.to || !tx.data) {
  throw new Error('[GAS] Invalid transaction: missing to or data');
}

  // 1️⃣ Gas Limit Estimation
  let gasLimit: BigNumber;
  try {
  const estimatedGas = await Promise.race([
    provider.estimateGas(tx),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Gas estimation timeout')), 5000)
    )
  ]);
  gasLimit = safeMultiply(estimatedGas, multipliers.gasBuffer).div(100);
  
  // Añadir límite mínimo/máximo de gas
  const MIN_GAS = BigNumber.from(100_000);
  const MAX_GAS = BigNumber.from(10_000_000);
  gasLimit = gasLimit.gt(MAX_GAS) ? MAX_GAS : gasLimit.lt(MIN_GAS) ? MIN_GAS : gasLimit;
  
  Logger.debug(`[GAS] Gas estimated: ${estimatedGas.toString()} | Buffered: ${gasLimit.toString()}`);
} catch (error) {
  const fallback = FALLBACK_VALUES[options.network];
  const errorMsg = extractErrorMessage(error);
  Logger.warn(`[GAS] Estimation failed: ${errorMsg}. Using fallback: ${fallback.gasLimit.toString()}`);
  gasLimit = fallback.gasLimit;
  simulationSuccess = false;
  isSimulationCriticalFailure = isCriticalError(errorMsg);
}

  // 2️⃣ Fee Data (cache-protected)
  const feeData = await getCachedFeeData(provider, options.network, options.forceRefreshCache || false);
  if (!isValidFeeData(feeData)) Logger.warn(`[GAS] Fee data incomplete, using fallback`);

  let maxFeePerGas = feeData.maxFeePerGas || FALLBACK_VALUES[options.network].maxFee;
  let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || FALLBACK_VALUES[options.network].priorityFee;

  maxFeePerGas = maxFeePerGas.mul(multipliers.feeMultiplier).div(100);
  maxPriorityFeePerGas = maxPriorityFeePerGas.mul(multipliers.priorityMultiplier).div(100);

  Logger.debug(`[GAS] Strategy ${strategy}: maxFee=${maxFeePerGas.toString()} | priority=${maxPriorityFeePerGas.toString()}`);

  // 3️⃣ Validate against block gas limit
  try {
    const block = await provider.getBlock('latest');
    if (gasLimit.gt(block.gasLimit)) {
      Logger.warn(`[GAS] Adjusted gasLimit exceeding block limit: ${gasLimit.toString()} > ${block.gasLimit.toString()}`);
      gasLimit = block.gasLimit.sub(100_000);
    }
  } catch (error) {
    Logger.warn(`[GAS] Failed fetching block gas limit: ${extractErrorMessage(error)}`);
  }

  // 4️⃣ Flashbots Simulation (only mainnet)
  if (options.simulate && options.flashbotsProvider && options.wallet) {
    if (options.network !== 'mainnet') {
      throw new Error('[SIMULATION] Flashbots simulation only supported on mainnet');
    }

    try {
      const populatedTx = {
        ...tx,
        chainId: (await provider.getNetwork()).chainId,
        type: 2,
        maxFeePerGas,
        maxPriorityFeePerGas
      };
      const signedTx = await options.wallet.signTransaction(populatedTx);
      const blockNumber = await provider.getBlockNumber();

      Logger.debug('[SIMULATION] Running Flashbots simulation...');
      try {
        const simulation = await Promise.race([
          options.flashbotsProvider.simulate([signedTx], blockNumber + 1),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Simulation timeout')), SIMULATION_TIMEOUT_MS))
        ]);

        if (simulation && typeof simulation === 'object' && 'error' in simulation) {
          const error = simulation.error instanceof Error 
            ? simulation.error 
            : new Error(String(simulation.error));
          
          Logger.warn(`[SIMULATION] Failure: ${error.message}`);
          
          if (isCriticalError(error.message)) {
            Logger.fatal(`[SIMULATION] Critical failure: ${error.message}`);
            isSimulationCriticalFailure = true;
            if (options.simulationStrict) throw error;
          }
          simulationSuccess = false;
        } else {
          Logger.debug(`[SIMULATION] Success`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown simulation error';
        Logger.warn(`[SIMULATION] Error: ${errorMessage}`);
        simulationSuccess = false;
      }
    } catch (error) {
      Logger.warn(`[SIMULATION] Setup failed: ${extractErrorMessage(error)}`);
      simulationSuccess = false;
    }
  }

  const estimatedGasCost = gasLimit.mul(maxFeePerGas);
  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    simulationSuccess,
    estimatedGasCost,
    isSimulationCriticalFailure
  };
}