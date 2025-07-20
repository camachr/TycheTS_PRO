// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/FlashLoanArbitrageOptimized.sol";

// Rol constante: keccak256("EXECUTOR_ROLE")
bytes32 constant EXECUTOR_ROLE = 0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63;

contract GrantExecutorRole is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address contractAddress = vm.envAddress("MAINNET_FLASHLOAN_CONTRACT");

        vm.startBroadcast();

        FlashLoanArbitrageOptimized flashloan = FlashLoanArbitrageOptimized(contractAddress);
        flashloan.grantRole(EXECUTOR_ROLE, deployer);

        vm.stopBroadcast();
    }
}
