import 'dotenv/config';
import { ethers, Wallet } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';

export async function connectFlashbotsProvider(
  provider: ethers.providers.JsonRpcProvider,
  authSigner: Wallet
): Promise<FlashbotsBundleProvider> {
  return await FlashbotsBundleProvider.create(provider, authSigner);
}
