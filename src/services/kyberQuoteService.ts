// src/services/kyberQuoteService.ts
import 'dotenv/config'; // Ensure environment variables are loaded
import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { JsonRpcProvider } from '@ethersproject/providers';
/**
 * KyberSwap Aggregator Quote Service
 * This service fetches the expected return for a token swap using the KyberSwap aggregator.
 * It uses the KyberSwap Aggregator contract to get the expected amount for a given input.
 */

const KYBER_AGGREGATOR_ABI = [
  'function getExpectedReturn(address srcToken, address destToken, uint256 srcQty, uint256 parts, uint256 flags) external view returns (uint256 expectedAmount, uint256[] memory distribution)'
];

export async function getKyberQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: ethers.BigNumber,
  provider: JsonRpcProvider
): Promise<ethers.BigNumber> {
  try {
    const kyberAggregator = process.env.MAINNET_KYBERSWAP_AGGREGATOR;
    if (!kyberAggregator) {
      Logger.warn('Kyber aggregator address is not configured');
      return ethers.BigNumber.from(0);
    }

    const contract = new ethers.Contract(kyberAggregator, KYBER_AGGREGATOR_ABI, provider);
    
    const [expectedAmount] = await contract.getExpectedReturn(
      tokenIn,
      tokenOut,
      amountIn,
      100,     // parts (set to 100 for precision)
      0        // flags = 0 (no special behavior)
    );

    return expectedAmount;
  } catch (error) {
    Logger.warn(`Kyber quote failed: ${error instanceof Error ? error.message : String(error)}`);
    return ethers.BigNumber.from(0);
  }
}
