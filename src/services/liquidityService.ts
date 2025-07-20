import { Contract, BigNumber, providers } from 'ethers';
import { SupportedNetwork } from '../config/networks';
import { NETWORKS } from '../config/networks';
import 'dotenv/config';

interface LiquidityInfo {
  amount: BigNumber;
  source: 'Aave' | 'dYdX' | 'None';
}

export async function getAaveLiquidity(
  flashloanContract: Contract,
  tokenAddress: string,
  provider: providers.Provider
): Promise<LiquidityInfo> {
  try {
    const poolAddress: string = await flashloanContract.POOL();
    const poolContract = new Contract(
      poolAddress,
      [
        'function getReserveData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint40)'
      ],
      provider
    );
    const reserveData = await poolContract.getReserveData(tokenAddress);
    return {
      amount: reserveData[0], // availableLiquidity
      source: 'Aave',
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`⚠️ Aave error: ${err.message}`);
    return { amount: BigNumber.from(0), source: 'None' };
  }
}

export async function getDydxLiquidity(
  flashloanContract: Contract,
  tokenAddress: string,
  provider: providers.Provider,
  network: SupportedNetwork
): Promise<BigNumber> {
  const dydxAddress = NETWORKS[network].CONTRACT_ADDRESSES.DYDX_SOLO_MARGIN;
  if (!dydxAddress || dydxAddress === '0x0000000000000000000000000000000000000000') {
    return BigNumber.from(0);
  }

  const dydx = new Contract(
    dydxAddress,
    [
      'function getMarketTotalPar(uint256) view returns (uint128 totalPar)',
      'function getMarketTokenAddress(uint256) view returns (address)',
    ],
    provider
  );

  try {
    const marketId = await flashloanContract.dydxMarketIds(tokenAddress);
    if (marketId.eq(0)) return BigNumber.from(0);

    const totalPar = await dydx.getMarketTotalPar(marketId);
    const tokenAtId = await dydx.getMarketTokenAddress(marketId);

    if (tokenAtId.toLowerCase() !== tokenAddress.toLowerCase()) {
      return BigNumber.from(0);
    }

    return BigNumber.from(totalPar.toString());
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`⚠️ dYdX error: ${err.message}`);
    return BigNumber.from(0);
  }
}
