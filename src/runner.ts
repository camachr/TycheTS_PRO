// src/runner.ts
import { Contract, providers, Wallet, BigNumber, ethers } from 'ethers';
import { Interface } from 'ethers/lib/utils'; // Import Interface for ABI decoding
import dotenv from 'dotenv';
import FlashLoanArbitrageOptimizedABI from './abi/FlashLoanArbitrageOptimized.json';
import path from 'path';
import 'dotenv/config';
import { loadFlashloanContract } from './utils/contractLoader';
import { connectFlashbotsProvider } from './utils/flashbotsUtils';
import { findArbitrageOpportunities } from './services/arbitrageService';
import { ArbitrageExecutor } from './executor';
import { prepareDexes } from './utils/prepareDexes';
import { prepareTokens } from './utils/prepareTokens';
import { delay } from './utils/timeUtils';
import { sendTelegramMessage } from './services/telegramService';
import { Logger } from './utils/logger';
import { initializeBotEnvironment } from './utils/environmentUtils';
import { ArbitrageOpportunity, SupportedNetwork } from './types';
import { ProfitTracker } from './utils/profitTracker';

// Validación de configuración
const validateConfig = () => {
  if (!process.env.MAINNET_DEXES) {
    throw new Error('MAINNET_DEXES no está definido en .env');
  }
  try {
    const dexes = JSON.parse(process.env.MAINNET_DEXES || '[]');
    if (!Array.isArray(dexes)) {
      throw new Error('MAINNET_DEXES debe ser un array válido');
    }
    Logger.info(`DEXES cargados: ${JSON.stringify(dexes)}`);
  } catch (e) {
    throw new Error(`Error parseando MAINNET_DEXES: ${e instanceof Error ? e.message : String(e)}`);
  }
};

// Configuración inicial
dotenv.config({ path: path.join(__dirname, '..', '.env') });
validateConfig();

const checkProviderConnection = async (provider: providers.JsonRpcProvider) => {
  await provider.getBlockNumber();
};

// Configuración de red y runner
const VALID_NETWORKS: SupportedNetwork[] = ['mainnet'];
const NETWORK = (process.env.NETWORK || 'mainnet') as SupportedNetwork;

if (!VALID_NETWORKS.includes(NETWORK)) {
  throw new Error(`Invalid NETWORK: ${NETWORK}. Must be one of ${VALID_NETWORKS.join(', ')}`);
}

const runnerConfig = {
  cycleDelay: Number(process.env.CYCLE_DELAY_MS) || 10_000,
  maxErrors: Number(process.env.MAX_CONSECUTIVE_ERRORS) || 5,
  statsInterval: Number(process.env.STATS_INTERVAL_MS) || 60_000,
  maxCycles: process.env.NODE_ENV === 'development' ? Number(process.env.DEV_MAX_CYCLES) || 20 : Infinity,
  minBalanceEth: Number(process.env.MIN_BALANCE_ETH) || 0.1,
  healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL) || 10,
  opportunitySearchTimeout: Number(process.env.OPPORTUNITY_TIMEOUT_MS) || 30_000,
  providerPingInterval: Number(process.env.PROVIDER_PING_INTERVAL_MS) || 30_000,
  profitBuffer: Number(process.env.PROFIT_BUFFER) || 0.1
};

// Funciones auxiliares
function calculateOpportunityScore(opp: ArbitrageOpportunity & { estimatedGasCost?: BigNumber, executionRisk?: number }): BigNumber {
  try {
    const complexityFactor = opp.path.length > 3 ? BigNumber.from(120) : BigNumber.from(100);
    const riskFactor = Math.max(opp.executionRisk || 1, 1);
    
    return opp.estimatedProfit
      .sub(opp.estimatedGasCost || BigNumber.from(0))
      .mul(100)
      .div(complexityFactor)
      .div(riskFactor);
  } catch (error) {
    Logger.error(`Error calculating score: ${error instanceof Error ? error.message : String(error)}`);
    return BigNumber.from(0);
  }
}

function selectBestOpportunity(opps: ArbitrageOpportunity[]): ArbitrageOpportunity {
  if (!opps || !Array.isArray(opps)) {
    throw new Error(`Invalid opportunities array: ${opps}`);
  }
  if (opps.length === 0) throw new Error('No opportunities available');
  
  return opps.reduce((best, current) => {
    const currentScore = calculateOpportunityScore(current);
    const bestScore = calculateOpportunityScore(best);
    const minProfit = current.estimatedGasCost
      ? current.estimatedGasCost.mul(Math.floor((1 + runnerConfig.profitBuffer) * 100)).div(100)
      : BigNumber.from(0);

    return currentScore.gt(bestScore) && current.estimatedProfit.gt(minProfit) 
      ? current 
      : best;
  });
}

async function performHealthCheck(
  provider: providers.JsonRpcProvider,
  wallet: Wallet,
  contract: Contract
): Promise<{ healthy: boolean; message: string }> {
  try {
    const [connectionOk, balanceOk, contractOk] = await Promise.all([
      checkProviderConnection(provider).then(() => true).catch(() => false),
      wallet.getBalance().then(bal => 
        bal.gte(ethers.utils.parseEther(String(runnerConfig.minBalanceEth)))
      ),
      contract.deployed().then(() => true).catch(() => false)
    ]);

    if (!connectionOk) return { healthy: false, message: 'Provider connection failed' };
    if (!balanceOk) return { healthy: false, message: 'Insufficient wallet balance' };
    if (!contractOk) return { healthy: false, message: 'Contract not available' };
    
    return { healthy: true, message: 'All systems operational' };
  } catch (error) {
    return { 
      healthy: false, 
      message: `Health check error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

async function getProviderWithRetry(): Promise<providers.JsonRpcProvider> {
  const { provider } = initializeBotEnvironment(NETWORK);
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      await checkProviderConnection(provider);
      return provider;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      await delay(2000 * retries);
    }
  }
  throw new Error('Failed to establish provider connection');
}

export async function safeFindOpportunities(
  provider: providers.JsonRpcProvider,
  contract: Contract,
  network: SupportedNetwork,
  tokens: any[],
  dexes: any[]
): Promise<ArbitrageOpportunity[]> {
  try {
    const opportunities = await Promise.race([
      findArbitrageOpportunities(provider, contract, network, tokens, dexes),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Opportunity search timeout')),
          runnerConfig.opportunitySearchTimeout)
      )
    ]);

    if (!opportunities || !Array.isArray(opportunities)) {
      Logger.warn('Invalid opportunities format');
      return [];
    }

    return opportunities.map((opp: any) => ({
      path: opp.path || opp.route || [],
      amountIn: BigNumber.from(opp.amountIn || opp.amount || 0),
      minAmountOut: BigNumber.from(opp.minAmountOut || 0),
      dexes: opp.dexes || opp.exchanges || [],
      estimatedProfit: BigNumber.from(opp.estimatedProfit || opp.profit || 0),
      ...(opp.estimatedGasCost ? { estimatedGasCost: opp.estimatedGasCost } : {}),
      ...(opp.executionRisk ? { executionRisk: opp.executionRisk } : {}),
      ...(opp.gasCost ? { estimatedGasCost: opp.gasCost } : {}),
      ...(opp.risk ? { executionRisk: opp.risk } : {})
    }));
  } catch (error: any) { // Add ': any' to error for better type handling
    const detailedErrorMessage = decodeTransactionError(error, FlashLoanArbitrageOptimizedABI);
    Logger.warn(`❌ Opportunity search failed: ${detailedErrorMessage}`);
    // You can also log the full error object if needed for deeper debugging
    // Logger.debug('Full error object for opportunity search:', error);
    return [];
  }
}

function startConnectionMonitor(provider: providers.JsonRpcProvider) {
  const interval = setInterval(async () => {
    try {
      await provider.getBlockNumber();
    } catch (error) {
      Logger.error(`Provider connection lost: ${error instanceof Error ? error.message : String(error)}`);
      clearInterval(interval);
      process.exit(1);
    }
  }, runnerConfig.providerPingInterval);

  return interval;
}
// Helper function to decode Ethers.js transaction errors
const decodeTransactionError = (error: any, contractAbi: any): string => {
  let decodedMessage = '';
  const iface = new Interface(contractAbi);

  // Check for common Ethers.js error structure first
  if (error.reason) {
    decodedMessage += `Reason: ${error.reason}. `;
  }
  if (error.code) {
    decodedMessage += `Code: ${error.code}. `;
  }
  if (error.method) {
    decodedMessage += `Method: ${error.method}. `;
  }

  // Attempt to decode custom contract revert reasons from error.data or error.error.data
  const errorData = error.data || (error.error && error.error.data);
  if (errorData && typeof errorData === 'string' && errorData.startsWith('0x')) {
    try {
      // If it's a known error, it will decode it
      const parsedError = iface.parseError(errorData);
      decodedMessage += `Contract Revert: ${parsedError.name}(${parsedError.args.map((arg: any) => arg.toString()).join(', ')}). `;
    } catch (e) {
      // If it's not a known error, it might be a simple string or an unknown error selector
      if (errorData === '0x08c379a0' || errorData.startsWith('0x08c379a0')) { // Error(string) selector
        try {
            const reason = ethers.utils.toUtf8String('0x' + errorData.slice(10));
            decodedMessage += `Contract Revert (string): ${reason}. `;
        } catch (stringDecodeErr) {
            decodedMessage += `Unknown Contract Revert Data: ${errorData}. `;
        }
      } else if (errorData === '0x4e487b71') { // Panic(uint256) selector
          decodedMessage += `Contract Panic (Solidity Error). `;
      } else {
        decodedMessage += `Raw Contract Data: ${errorData}. `;
      }
    }
  }

  // Fallback to generic error message if nothing specific was found
  if (!decodedMessage && error instanceof Error) {
    decodedMessage = error.message;
  } else if (!decodedMessage) {
    decodedMessage = String(error);
  }

  return decodedMessage.trim();
};
// Función principal
async function main() {
  try {
    ProfitTracker.load();

    const provider = await getProviderWithRetry();
    const { wallet } = initializeBotEnvironment(NETWORK);
    const connectionMonitor = startConnectionMonitor(provider);

    const rawDexes = prepareDexes(NETWORK);
    if (!Array.isArray(rawDexes) || rawDexes.length === 0) {
      throw new Error(`❌ prepareDexes returned invalid or empty result for network: ${NETWORK}`);
    }

    const dexes = rawDexes.map(dex => ({
      name: dex.name,
      router: dex.router,
      type: dex.type
    }));

    const tokens = prepareTokens(NETWORK);
    const contract = await loadFlashloanContract(NETWORK, wallet);
    const flashbotsProvider = NETWORK === 'mainnet' 
      ? await connectFlashbotsProvider(provider, wallet) 
      : undefined;

    const { healthy, message } = await performHealthCheck(provider, wallet, contract);
    if (!healthy) throw new Error(message);

    Logger.success('🟢 Bot initialized successfully');
    await sendTelegramMessage(`🟢 Bot started on *${NETWORK}* network`);

    let cycles = 0;
    let errors = 0;
    let lastOpportunitiesCount = 0;

    setInterval(() => {
      Logger.info(`[STATS] Cycles: ${cycles}, Errors: ${errors}, Last opps: ${lastOpportunitiesCount}`);
    }, runnerConfig.statsInterval);

    const executor = new ArbitrageExecutor(provider, wallet, contract, flashbotsProvider, NETWORK);

    while (cycles < runnerConfig.maxCycles && errors < runnerConfig.maxErrors) {
      const cycleStart = Date.now();

      try {
        if (cycles % runnerConfig.healthCheckInterval === 0) {
          const { healthy, message } = await performHealthCheck(provider, wallet, contract);
          if (!healthy) throw new Error(message);
        }

        const filteredTokens = tokens?.filter?.(token => token?.symbol) || [];
        const opportunities = await safeFindOpportunities(provider, contract, NETWORK, filteredTokens, dexes);
        lastOpportunitiesCount = opportunities.length;

        if (opportunities.length > 0) {
          Logger.info(`🚀 Found ${opportunities.length} opportunities`);
          try {
            const selected = selectBestOpportunity(opportunities);
            await executor.execute(selected);
            cycles++;
            errors = 0;
          } catch (error: any) { // Add ': any' to error
            errors++;
            const detailedErrorMessage = decodeTransactionError(error, FlashLoanArbitrageOptimizedABI);
            Logger.warn(`⚠️ Cycle execution error: ${detailedErrorMessage}`);
            // Logger.debug('Full error object for cycle execution:', error); // Optional: log full error
            if (errors >= 3) {
              await sendTelegramMessage(`⚠️ Consecutive cycle error #${errors}: ${detailedErrorMessage}`);
            }
          }
        }

        const cycleTime = Date.now() - cycleStart;
        const remainingDelay = runnerConfig.cycleDelay - cycleTime;
        if (remainingDelay > 0) await delay(remainingDelay);
      } catch (innerError) {
        errors++;
        Logger.warn(`❌ Unhandled error during cycle: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
      }
    }

    clearInterval(connectionMonitor);
    const exitMessage = errors >= runnerConfig.maxErrors
      ? `❌ Max error threshold (${runnerConfig.maxErrors}) reached`
      : `✅ Completed ${cycles} cycles`;

    Logger.fatal(exitMessage);
    await sendTelegramMessage(exitMessage);
    process.exit(errors >= runnerConfig.maxErrors ? 1 : 0);

  } catch (error: any) { // Add ': any' to error
    const detailedErrorMessage = decodeTransactionError(error, FlashLoanArbitrageOptimizedABI);
    Logger.fatal(`💥 Startup failed: ${detailedErrorMessage}`);
    await sendTelegramMessage(`💥 Startup failed: ${detailedErrorMessage}`);
    process.exit(1);
  }
}

// Manejo de eventos del proceso
process.on('SIGINT', () => {
  Logger.info('🛑 Received graceful shutdown signal');
  sendTelegramMessage('🛑 Bot shutting down gracefully')
    .finally(() => process.exit(0));
});

process.on('uncaughtException', async (error) => {
  Logger.fatal(`💥 Uncaught exception: ${error instanceof Error ? error.message : String(error)}`);
  await sendTelegramMessage(`💥 Critical error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  Logger.fatal(`💥 Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  await sendTelegramMessage(`💥 Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  process.exit(1);
});

main();