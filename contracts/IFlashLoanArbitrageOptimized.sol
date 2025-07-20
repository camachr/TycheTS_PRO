// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFlashLoanArbitrageOptimized {
    function initialize(address uniswapV2Router, address uniswapV3Router, address owner) external;
}
