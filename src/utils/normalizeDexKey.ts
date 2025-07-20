/**
 * Normaliza el nombre de un DEX (Exchange Descentralizado) para coincidir con las claves de configuración.
 * Ejemplos:
 * - "Uniswap V3" → "uniswap_v3"
 * - "Sushi-Swap" → "sushi_swap"
 * - "PancakeSwap" → "pancakeswap"
 */
import 'dotenv/config';
export function normalizeDexKey(dex: string): string {
  if (!dex || typeof dex !== 'string') {
    throw new Error('❌ normalizeDexKey: Input must be a non-empty string');
  }

  return dex
    .toLowerCase()           // Convertir a minúsculas
    .replace(/[\s-]+/g, '_')  // Reemplazar espacios o guiones por _
    .replace(/[^a-z0-9_]/g, '')  // Eliminar caracteres especiales
    .trim();
}