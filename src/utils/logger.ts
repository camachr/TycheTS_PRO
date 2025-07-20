// src/utils/logger.ts
import chalk from 'chalk';
import 'dotenv/config';
export const Logger = {
  info: (message: string) => console.log(chalk.blue(`[INFO] ${new Date().toISOString()} - ${message}`)),
  success: (message: string) => console.log(chalk.green(`[SUCCESS] ${new Date().toISOString()} - ${message}`)),
  warn: (message: string) => console.log(chalk.yellow(`[WARN] ${new Date().toISOString()} - ${message}`)),
  error: (message: string) => console.log(chalk.red(`[ERROR] ${new Date().toISOString()} - ${message}`)),
  fatal: (message: string) => console.log(chalk.bgRed.white(`[FATAL] ${new Date().toISOString()} - ${message}`)),
  debug: (message: string) => {
    if (process.env.DEBUG === 'true') {
      console.log(chalk.gray(`[DEBUG] ${new Date().toISOString()} - ${message}`));
    }
  },
  telegram: (message: string | object, error?: unknown) => {
  // Función de serialización segura
  const safeStringify = (data: unknown): string => {
    try {
      return typeof data === 'string' 
        ? data 
        : JSON.stringify(data, (_, value) => {
            if (typeof value === 'bigint') return `${value.toString()}n`;
            if (value instanceof Error) return value.stack || value.message;
            if (typeof value === 'function') return '[Function]';
            return value;
          }, 2);
    } catch {
      return '[Unserializable Data]';
    }
  };

  // Formateo del mensaje base
  const timestamp = new Date().toISOString();
  const formattedMessage = `[TELEGRAM] ${timestamp} - ${safeStringify(message)}`;

  // Formateo del error (si existe)
  const formattedError = error 
    ? ` | Error: ${error instanceof Error 
        ? safeStringify({
            message: error.message,
            stack: error.stack,
            name: error.name
          }) 
        : safeStringify(error)}`
    : '';

  // Salida con color
  console.log(chalk.magenta(`${formattedMessage}${formattedError}`));
},
}

