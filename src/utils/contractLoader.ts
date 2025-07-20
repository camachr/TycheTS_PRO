// src/utils/contractLoader.ts

import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { SupportedNetwork, NETWORKS } from '../config/networks';

export async function loadFlashloanContract(
  network: SupportedNetwork,
  wallet: ethers.Wallet
): Promise<ethers.Contract> {
  const useMock = process.env.USE_MOCK === 'true';

  if (useMock) {
    const cachePath = path.resolve('broadcast', 'DeployMock.sol', '1', 'run-latest.json');
    if (!fs.existsSync(cachePath)) {
      throw new Error('❌ Mock contract no encontrado. Asegúrate de ejecutar `make deploy-mock` primero.');
    }

    let cacheRaw = fs.readFileSync(cachePath, 'utf8').replace(/[\x00-\x1F\x7F]/g, '');
    let cache: any;

    try {
      cache = JSON.parse(cacheRaw);
    } catch (parseErr) {
      const firstJsonEnd = cacheRaw.indexOf('}{', 100);
      if (firstJsonEnd !== -1) {
        const safeRaw = cacheRaw.slice(0, firstJsonEnd + 1);
        try {
          cache = JSON.parse(safeRaw);
        } catch (secondErr) {
          console.error('📁 Contenido del archivo cache malformado:\n', safeRaw);
          throw new Error(`❌ No se pudo recuperar el JSON válido del cache: ${secondErr}`);
        }
      } else {
        console.error('📁 Contenido del archivo cache malformado:\n', cacheRaw);
        throw new Error(`❌ Archivo de cache inválido: ${parseErr}`);
      }
    }

    const mockTx = [...(cache.transactions || [])]
      .reverse()
      .find((tx: any) => {
        const hasAddress = typeof tx.contractAddress === 'string' && /^0x[a-fA-F0-9]{40}$/.test(tx.contractAddress);
        const isFlashloan = tx.contractName === 'FlashLoanArbitrageMocked' ||
          tx.contractName?.toLowerCase().includes('flashloan');
        return hasAddress && isFlashloan;
      });

    if (!mockTx?.contractAddress) {
      throw new Error('❌ Dirección del contrato mock no encontrada en el archivo de cache.');
    }

    const mockAddress = mockTx.contractAddress;
    const abiPath = path.resolve('out', 'FlashLoanArbitrageMocked.sol', 'FlashLoanArbitrageMocked.json');
    if (!fs.existsSync(abiPath)) {
      throw new Error(`❌ ABI no encontrada en: ${abiPath}`);
    }

    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;

  
  
function validateABI(abi: any[], requiredFunction: string) {
  // 1. Validación de estructura
  if (!abi || !Array.isArray(abi)) {
    throw new Error(`ABI debe ser un array. Recibido: ${typeof abi}`);
  }

  // 2. Extracción segura de nombres
  const functionNames = abi
    .filter(entry => entry?.type === 'function')
    .map(entry => entry.name)
    .filter(Boolean);

  // 3. Verificación
  if (!functionNames.includes(requiredFunction)) {
    const available = functionNames.length ? functionNames.join(', ') : 'Ninguna función encontrada';
    throw new Error([
      `Función requerida "${requiredFunction}" no encontrada.`,
      `Funciones disponibles en ABI: ${available}`,
      `Total entries en ABI: ${abi.length}`
    ].join('\n'));
  }
}

// Uso:
validateABI(abi, 'executeFlashLoanAave');


    return new ethers.Contract(mockAddress, abi, wallet);
  }

  const config = NETWORKS[network];
  const address = config.CONTRACT_ADDRESSES.FLASHLOAN_CONTRACT;
  const abiPath = path.resolve('src', 'abi', 'FlashLoanArbitrageOptimized.json');

 if (!fs.existsSync(abiPath)) {
  throw new Error(`❌ ABI no encontrada en: ${abiPath}`);
}

// Carga robusta del ABI con validación
let abi: any[];
try {
  const abiFileContent = fs.readFileSync(abiPath, 'utf8');
  const abiJson = JSON.parse(abiFileContent);
  
  // Modificación clave: acepta tanto {abi: [...]} como [...]
  abi = Array.isArray(abiJson) ? abiJson : (abiJson?.abi || []);
  
  if (!Array.isArray(abi) || abi.length === 0) {
    throw new Error(`
      ❌ Estructura ABI inválida en ${path.basename(abiPath)}.
      Se esperaba { abi: [...] } o array directo, pero se recibió: ${JSON.stringify(abiJson, null, 2).slice(0, 200)}...
    `);
  }
} catch (err) {
  throw new Error(`
    ❌ Error cargando ABI desde ${abiPath}
    ${err instanceof Error ? err.message : 'Error desconocido'}
    ${fs.existsSync(abiPath) ? `Tamaño del archivo: ${fs.statSync(abiPath).size} bytes` : ''}
  `);
}

// Funciones requeridas para el contrato FlashLoanArbitrage
const REQUIRED_FUNCTIONS = ['executeFlashLoanAave'];

// Validación de funciones esenciales
try {
  validateContractABI(abi, REQUIRED_FUNCTIONS, { 
    contractName: 'FlashLoanArbitrageOptimized' 
  });
} catch (validationError) {
  throw new Error(`
    ❌ Validación ABI falló para ${path.basename(abiPath)}
    ${validationError instanceof Error ? validationError.message : 'Error de validación'}
    Ruta completa: ${abiPath}
  `);
}
  
    
// Validación reforzada de ABI
function validateContractABI(
  abi: any[],
  requiredFunctions: string[],
  options?: { contractName?: string }
) {
  // Validación básica
  if (!Array.isArray(abi)) {
    throw new Error(`[${options?.contractName || 'Contract'}] ABI must be an array (received ${typeof abi})`);
  }

  // Extracción segura
  const availableFunctions = abi
    .filter(entry => entry?.type === 'function' && typeof entry.name === 'string')
    .map(entry => entry.name);

  // Verificación
  const missingFunctions = requiredFunctions.filter(fn => !availableFunctions.includes(fn));

  if (missingFunctions.length > 0) {
    throw new Error([
      `[${options?.contractName || 'Contract'}] ABI Validation Failed:`,
      `Missing ${missingFunctions.length} required function(s):`,
      `=> Required: ${requiredFunctions.join(', ')}`,
      `=> Missing: ${missingFunctions.join(', ')}`,
      `=> Available: ${availableFunctions.join(', ') || 'None'}`,
      `=> Total ABI entries: ${abi.length}`
    ].join('\n'));
  }

  return true; // Validación exitosa
}

// Añadir cache de contrato
const contractCache = new Map<string, ethers.Contract>();
const cacheKey = `${network}:${address}`;

if (contractCache.has(cacheKey)) {
  return contractCache.get(cacheKey)!;
}

const contract = new ethers.Contract(address, abi, wallet);
contractCache.set(cacheKey, contract);
return contract;
}
