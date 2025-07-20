// src/executor.ts
import { BigNumber, Contract, ethers, PopulatedTransaction, providers, Wallet } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { Logger } from './utils/logger';
import { delay } from './utils/timeUtils';
import { SupportedNetwork } from './config/networks';
import { ArbitrageOpportunity } from './types';
import { TelegramNotifier } from './services/notificationService';
import { estimateOptimalGas, GasEstimates } from './services/gasService';
import { ProfitTracker } from './utils/profitTracker';
import { validateOpportunity } from './utils/validateOpportunity';
import { volatilityData as networkVolatility } from './config/volatility';
import 'dotenv/config';


type ExecutionResult = {
  success: boolean;
  txHash?: string;
  estimatedProfit: BigNumber;
  actualProfit?: BigNumber;
  profitDeviation?: BigNumber;
  metrics: ExecutionMetrics;
  healthStatus: 'ok' | 'degraded' | 'critical';
};

interface ExecutionMetrics {
  preparationTime: number;
  gasEstimationTime: number;
  executionTime: number;
  totalTime: number;
  gasUsed?: BigNumber;
}

export class ArbitrageExecutor {
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly PROFIT_THRESHOLD_MULTIPLIER = 1.1;
  private readonly FLASHBOTS_RETRY_BLOCKS = 3;
  private readonly STANDARD_MAX_RETRIES = 3;
  private readonly TX_TIMEOUT_MS = 30000;

  constructor(
    private readonly provider: providers.JsonRpcProvider,
    private readonly wallet: Wallet,
    private readonly contract: Contract,
    private readonly flashbotsProvider?: FlashbotsBundleProvider,
    private readonly network: SupportedNetwork = 'mainnet'
  ) {}

  public async execute(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    const startTime = Date.now();
    const metrics: ExecutionMetrics = {
      preparationTime: 0,
      gasEstimationTime: 0,
      executionTime: 0,
      totalTime: 0
    };

    try {
  Logger.info(`🚀 Attempting arbitrage | Estimated Profit: ${ethers.utils.formatEther(opportunity.estimatedProfit)} ETH`);

  if (!validateOpportunity(opportunity)) {
    Logger.warn("⛔ Invalid opportunity structure. Skipping execution.");
    return {
      success: false,
      estimatedProfit: opportunity.estimatedProfit,
      metrics,
      healthStatus: this.getHealthStatus()
    };
  }


      // 💡 NUEVO BLOQUE: Validación de profit mínimo absoluto
    if (opportunity.estimatedProfit.lte(ethers.constants.Zero)) {
      Logger.warn("⛔ Estimated profit is zero or negative. Skipping execution.");
      return {
        success: false,
        estimatedProfit: opportunity.estimatedProfit,
        metrics,
        healthStatus: this.getHealthStatus()
      };
    }
      // 1️⃣ Preparation Phase
      const prepStart = Date.now();
      const txData = await this.prepareTransaction(opportunity);
      metrics.preparationTime = Date.now() - prepStart;

      // 2️⃣ Gas Estimation Phase
      const gasStart = Date.now();
      const gasEstimates = await this.estimateGas(txData);
      metrics.gasEstimationTime = Date.now() - gasStart;

      // 3️⃣ Profit Validation
      this.validateProfit(opportunity, gasEstimates);

      // 4️⃣ Balance Check
      await this.checkBalance(opportunity, gasEstimates);

      // 5️⃣ Build Transaction
      const populatedTx = this.buildTransaction(txData, gasEstimates);

      // 6️⃣ Execute Transaction
      const execStart = Date.now();
      const result = await this.executeTransaction(populatedTx);
      metrics.executionTime = Date.now() - execStart;

      // 7️⃣ Post-Execution Processing
      return await this.handleSuccess(result, opportunity, metrics, startTime);
    } catch (error) {
      return this.handleError(error, opportunity, metrics, startTime);
    }
  }

  private async prepareTransaction(opportunity: ArbitrageOpportunity): Promise<PopulatedTransaction> {
    return await this.contract.populateTransaction.executeArbitrage(
      opportunity.path,
      opportunity.amountIn,
      opportunity.minAmountOut,
      opportunity.dexes
    );
  }

  private async estimateGas(txData: PopulatedTransaction): Promise<GasEstimates> {
  const strategy =
    process.env.DYNAMIC_SLIPPAGE === 'true' ? 'aggressive' : 'balanced';

  const volatility = networkVolatility[this.network] || {};

  const gasEstimates = await estimateOptimalGas(txData, this.provider, {
    network: this.network,
    strategy,
    simulate: true,
    flashbotsProvider: this.flashbotsProvider,
    wallet: this.wallet,
    simulationStrict: false,
    dynamicSlippage: process.env.DYNAMIC_SLIPPAGE === 'true',
    volatilityData: volatility
  });

  if (gasEstimates.gasLimit.isZero() || gasEstimates.gasLimit.gt(BigNumber.from(5_000_000))) {
    throw new Error(`Invalid gas limit estimated: ${gasEstimates.gasLimit.toString()}`);
  }

  if (gasEstimates.isSimulationCriticalFailure) {
    throw new Error('Critical Flashbots simulation failure');
  }

  return gasEstimates;
}


  private validateProfit(opportunity: ArbitrageOpportunity, gasEstimates: GasEstimates): void {
    const minProfit = gasEstimates.estimatedGasCost.mul(this.PROFIT_THRESHOLD_MULTIPLIER);
    if (opportunity.estimatedProfit.lte(minProfit)) {
      throw new Error(
        `Profit too low: ${ethers.utils.formatEther(opportunity.estimatedProfit)} ≤ ${ethers.utils.formatEther(minProfit)} ETH`
      );
    }
  }

  private async checkBalance(opportunity: ArbitrageOpportunity, gasEstimates: GasEstimates): Promise<void> {
    const requiredBalance = gasEstimates.estimatedGasCost.add(opportunity.amountIn);
    const walletBalance = await this.getBalanceWithTimeout();
    if (walletBalance.lt(requiredBalance)) {
      throw new Error('Insufficient wallet balance for gas + flashloan');
    }
  }

  private buildTransaction(txData: PopulatedTransaction, gasEstimates: GasEstimates): PopulatedTransaction {
    const populatedTx: PopulatedTransaction = {
      ...txData,
      gasLimit: gasEstimates.gasLimit,
      maxFeePerGas: gasEstimates.maxFeePerGas,
      maxPriorityFeePerGas: gasEstimates.maxPriorityFeePerGas,
      type: 2
    };

    Logger.debug(
      `Transaction built | Nonce: ${this.wallet.getTransactionCount()} | GasLimit: ${populatedTx.gasLimit?.toString()}`
    );

    return populatedTx;
  }

  private async executeTransaction(tx: PopulatedTransaction): Promise<{ txHash: string; gasUsed?: BigNumber }> {
    if (this.flashbotsProvider) {
      return this.executeWithFlashbots(tx);
    }
    return this.executeStandard(tx);
  }

  private async executeWithFlashbots(tx: PopulatedTransaction): Promise<{ txHash: string; gasUsed?: BigNumber }> {
    if (!this.flashbotsProvider) {
      throw new Error('Flashbots provider not initialized');
    }

    const signedTx = await this.wallet.signTransaction(tx);
    const txHash = ethers.utils.keccak256(signedTx);
    let baseBlock = await this.provider.getBlockNumber();

    for (let i = 0; i < this.FLASHBOTS_RETRY_BLOCKS; i++) {
      try {
        const currentBlock = await this.safeGetBlock('latest', baseBlock);
        baseBlock = currentBlock.number;

        // Enviar bundle directamente sin esperar confirmación
        await this.flashbotsProvider.sendBundle(
          [
            {
              signedTransaction: signedTx,
              signer: this.wallet
            }
          ],
          baseBlock + i + 1
        );

        Logger.success(`✅ Flashbots bundle submitted for block ${baseBlock + i + 1}`);
        return { txHash };

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        Logger.warn(`⚠️ Flashbots attempt ${i + 1} failed: ${err.message}`);
      }
    }
    throw new Error('Flashbots bundle failed after all retries');
  }

  private async executeStandard(tx: PopulatedTransaction, retries = 0): Promise<{ txHash: string; gasUsed?: BigNumber }> {
    while (retries < this.STANDARD_MAX_RETRIES) {
      try {
        const txResponse = await this.wallet.sendTransaction(tx);
        const receipt = await this.waitForTransactionReceipt(txResponse.hash);
        Logger.success(`✅ Standard tx mined: ${receipt.transactionHash}`);
        return { txHash: receipt.transactionHash, gasUsed: receipt.gasUsed };
      } catch (error) {
        Logger.warn(`⚠️ Standard retry ${retries + 1}: ${error instanceof Error ? error.message : String(error)}`);
        await delay(1000 * (retries + 1));
        retries++;
      }
    }
    throw new Error('Standard execution failed after retries');
  }

  private async calculateActualProfit(txHash: string, opportunity: ArbitrageOpportunity, gasUsed?: BigNumber): Promise<BigNumber> {
    const initialBalance = await this.getBalanceWithTimeout();
    const receipt = await this.waitForTransactionReceipt(txHash);
    const usedGas = receipt.gasUsed || gasUsed || BigNumber.from(0);
    const gasCost = usedGas.mul(receipt.effectiveGasPrice ?? BigNumber.from(0));
    const finalBalance = await this.getBalanceWithTimeout();
    return finalBalance.add(gasCost).sub(initialBalance);
  }

  private async handleSuccess(
    result: { txHash: string; gasUsed?: BigNumber },
    opportunity: ArbitrageOpportunity,
    metrics: ExecutionMetrics,
    startTime: number
  ): Promise<ExecutionResult> {
    const actualProfit = await this.calculateActualProfit(result.txHash, opportunity, result.gasUsed);
    const profitDeviation = actualProfit.sub(opportunity.estimatedProfit);
    this.consecutiveFailures = 0;
    metrics.totalTime = Date.now() - startTime;

    this.evaluateProfitDeviation(profitDeviation, opportunity);
    ProfitTracker.add(actualProfit);

    return {
      success: true,
      txHash: result.txHash,
      estimatedProfit: opportunity.estimatedProfit,
      actualProfit,
      profitDeviation,
      metrics,
      healthStatus: this.getHealthStatus()
    };
  }

  private handleError(
    error: unknown,
    opportunity: ArbitrageOpportunity,
    metrics: ExecutionMetrics,
    startTime: number
  ): ExecutionResult {
    const errMsg = error instanceof Error ? error.message : String(error);
    Logger.error(`❌ Execution failed: ${errMsg}`);
    TelegramNotifier.send(`❌ Execution failed: ${errMsg}`);
    this.consecutiveFailures++;
    metrics.totalTime = Date.now() - startTime;
    this.checkCircuitBreaker();

    return {
      success: false,
      estimatedProfit: opportunity.estimatedProfit,
      metrics,
      healthStatus: this.getHealthStatus()
    };
  }

  private evaluateProfitDeviation(deviation: BigNumber, opportunity: ArbitrageOpportunity): void {
    const deviationPct = deviation.abs().mul(100).div(opportunity.estimatedProfit);
    if (deviationPct.gt(20)) {
      Logger.warn(`⚠️ Profit deviation > 20%: ${ethers.utils.formatEther(deviation)} ETH`);
      TelegramNotifier.send(`⚠️ Profit deviation: ${ethers.utils.formatEther(deviation)} ETH`);
    }
  }

  private checkCircuitBreaker(): void {
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      const msg = `🚨 Circuit breaker triggered: ${this.consecutiveFailures} consecutive failures`;
      Logger.fatal(msg);
      TelegramNotifier.send(msg);
      throw new Error(msg);
    }
  }

  private getHealthStatus(): 'ok' | 'degraded' | 'critical' {
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) return 'critical';
    if (this.consecutiveFailures >= 2) return 'degraded';
    return 'ok';
  }

  private async safeGetBlock(tag: string, fallbackNumber: number): Promise<providers.Block> {
    try {
      return await this.provider.getBlock(tag);
    } catch (error1) {
      Logger.warn(`Primary block fetch failed (${tag}), trying fallback: ${fallbackNumber}`);
      try {
        return await this.provider.getBlock(fallbackNumber);
      } catch (error2) {
        throw new Error(`Both block fetches failed: ${String(error1)} | ${String(error2)}`);
      }
    }
  }

  private async waitForTransactionReceipt(txHash: string): Promise<providers.TransactionReceipt> {
    try {
      return await Promise.race([
        this.provider.waitForTransaction(txHash, 2),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Receipt wait timeout')), this.TX_TIMEOUT_MS);
        })
      ]);
    } catch (error) {
      throw new Error(`Failed waiting for transaction receipt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getBalanceWithTimeout(): Promise<BigNumber> {
    try {
      return await Promise.race([
        this.wallet.getBalance(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Balance fetch timeout')), this.TX_TIMEOUT_MS);
        })
      ]);
    } catch (error) {
      throw new Error(`Failed fetching balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const execute = (
  config: {
    provider: providers.JsonRpcProvider;
    wallet: Wallet;
    contract: Contract;
    flashbotsProvider?: FlashbotsBundleProvider;
    network: SupportedNetwork;
  },
  opportunity: ArbitrageOpportunity
) => {
  const executor = new ArbitrageExecutor(
    config.provider,
    config.wallet,
    config.contract,
    config.flashbotsProvider,
    config.network
  );
  return executor.execute(opportunity);
};
