import { getEnv } from '../config/envUtils';
import { SupportedNetwork } from '../types';
import 'dotenv/config';
type DexType = 'V2' | 'V3';

interface DexInfo {
  name: string;
  router: string;
  type: DexType;
  quoter?: string;
  fees?: Record<string, number>;
}

export function prepareDexes(network: SupportedNetwork): DexInfo[] {
  const dexNames = JSON.parse(getEnv(`${network.toUpperCase()}_DEXES`)) as string[];

  return dexNames.map((name: string) => {
    const routerEnvName = `${network.toUpperCase()}_${name.toUpperCase()}_ROUTER`;
    const router = getEnv(routerEnvName);
    
    const type: DexType = name.includes('V3') ? 'V3' : 'V2';
    
    const dexInfo: DexInfo = {
      name,
      router,
      type
    };

    if (type === 'V3') {
      // Configuración específica para DEXs V3
      dexInfo.quoter = getEnv(`${network.toUpperCase()}_${name.toUpperCase()}_QUOTER`);
      dexInfo.fees = {
        USDC_WETH: 3000, // 0.3%
        USDC_WBTC: 3000,
        WETH_USDC: 3000,
        WETH_WBTC: 3000,
        DAI_WETH: 3000,
        USDC_DAI: 500 // 0.05% para stablecoins
      };
    }

    return dexInfo;
  });
}