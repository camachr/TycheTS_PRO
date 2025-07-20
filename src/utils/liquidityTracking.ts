// src/utils/liquidityTracking.ts
import 'dotenv/config';
import { sendTelegramMessage } from '../services/telegramService';

// Mapa para rastrear tokens sin liquidez (clave: "network:symbol")
const noLiquidityMap: Record<string, { count: number; lastChecked: number }> = {};

// Tiempo de espera antes de reintentar (30 minutos en milisegundos)
const LIQUIDITY_TIMEOUT_MS = 30 * 60 * 1000; 

// Máximo de intentos antes de ignorar el token
const MAX_NO_LIQUIDITY_ATTEMPTS = 3;

/**
 * Rastrea tokens sin liquidez y decide si deben omitirse temporalmente.
 * @param key - Formato "network:symbol" (ej: "mainnet:WETH")
 * @returns `true` si el token debe omitirse (por exceder intentos).
 */
export function trackNoLiquidity(key: string): boolean {
  const entry = noLiquidityMap[key];

  if (!entry) {
    noLiquidityMap[key] = { count: 1, lastChecked: Date.now() };
    return false;
  }

  // Si aún no ha pasado el tiempo de espera, omite el token
  if (Date.now() - entry.lastChecked < LIQUIDITY_TIMEOUT_MS) {
    return entry.count >= MAX_NO_LIQUIDITY_ATTEMPTS;
  }

  // Reinicia el contador si ha pasado el tiempo de espera
  if (entry.count >= MAX_NO_LIQUIDITY_ATTEMPTS) {
    sendTelegramMessage(`♻️ Reintentando token ${key} después de tiempo de espera`);
  }

  noLiquidityMap[key] = { count: 1, lastChecked: Date.now() };
  return false;
}

/**
 * Reinicia el contador para un token (usado cuando se encuentra liquidez).
 * @param key - Formato "network:symbol"
 */
export function resetNoLiquidityCounter(key: string): void {
  if (noLiquidityMap[key]) {
    delete noLiquidityMap[key];
    console.log(`✅ Liquidez restaurada para ${key}`);
  }
}