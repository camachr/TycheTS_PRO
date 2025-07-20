import * as dotenv from 'dotenv';
import * as path from 'path';
import 'dotenv/config';

// Carga las variables de entorno desde el archivo .env en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Obtiene una variable de entorno y lanza un error si no está definida.
 * @param key - Nombre de la variable de entorno
 * @returns Valor de la variable de entorno
 * @throws Error si la variable no está definida
 */
export function getEnv(key: string): string {
    const value = process.env[key];
    if (value === undefined || value === '') {
        throw new Error(`❌ Variable de entorno faltante o vacía: ${key}`);
    }
    return value;
}

/**
 * Obtiene una variable de entorno opcional (devuelve undefined si no existe)
 * @param key - Nombre de la variable de entorno
 * @returns Valor de la variable o undefined
 */
export function getOptionalEnv(key: string): string | undefined {
    return process.env[key];
}

/**
 * Valida y parsea un JSON desde una variable de entorno
 * @param key - Nombre de la variable de entorno que contiene el JSON
 * @returns Objeto parseado
 * @throws Error si el JSON es inválido
 */
export function getJsonEnv(key: string): any {
    try {
        return JSON.parse(getEnv(key));
    } catch (error) {
        const err = error as Error;
        throw new Error(`❌ JSON inválido en variable ${key}: ${err.message}`);
    }
}

/**
 * Obtiene un número desde una variable de entorno
 * @param key - Nombre de la variable de entorno
 * @returns Número parseado
 * @throws Error si no es un número válido
 */
export function getNumberEnv(key: string): number {
    const value = getEnv(key);
    const number = parseFloat(value);
    if (isNaN(number)) {
        throw new Error(`❌ Valor no numérico en variable ${key}: ${value}`);
    }
    return number;
}