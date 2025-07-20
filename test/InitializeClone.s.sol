// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IFlashLoanArbitrageClone {
    function initialize(address admin, address[] calldata routersV2, address[] calldata routersV3) external;
}

contract InitializeClone is Script {
    function run() external {
        address clone = vm.envAddress("CLONE_ADDRESS");
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        address[] memory routersV2 = new address[](1);
        routersV2[0] = vm.envAddress("MAINNET_UNISWAP_V2_ROUTER"); // o vacío si no usas
        address[] memory routersV3 = new address[](1);
        routersV3[0] = vm.envAddress("MAINNET_UNISWAP_V3_ROUTER"); // o vacío si no usas

        vm.startBroadcast();
        IFlashLoanArbitrageClone(clone).initialize(admin, routersV2, routersV3);
        vm.stopBroadcast();
        console.log("Clone inicializado en:", clone);
    }
}
