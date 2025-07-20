import 'dotenv/config';
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  export function timestamp(): string {
    return new Date().toISOString();
  }
  