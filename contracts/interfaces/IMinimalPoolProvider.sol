// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Solo la interfaz mínima que necesita FlashLoanSimpleReceiverBase
interface IMinimalPoolProvider {
    function getPool() external view returns (address);
}
