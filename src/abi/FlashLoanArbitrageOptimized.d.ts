// src/abi/FlashLoanArbitrageOptimized.d.ts

// This type definition ensures TypeScript understands the structure of a standard Ethereum ABI.
// Each entry in the ABI array can be a function, event, or error.
type AbiInputOutput = {
  readonly internalType?: string;
  readonly name?: string;
  readonly type: string;
  readonly indexed?: boolean;
  readonly components?: AbiInputOutput[]; // For tuple types
};

type AbiEntry = {
  readonly inputs?: AbiInputOutput[];
  readonly name?: string;
  readonly type: 'function' | 'constructor' | 'event' | 'error' | 'fallback' | 'receive';
  readonly anonymous?: boolean; // For events
  readonly outputs?: AbiInputOutput[]; // For functions
  readonly stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'; // For functions
};

// The ABI itself is an array of these entries.
declare const FlashLoanArbitrageOptimizedABI: readonly AbiEntry[];

// Export the default so it can be imported directly.
export default FlashLoanArbitrageOptimizedABI;