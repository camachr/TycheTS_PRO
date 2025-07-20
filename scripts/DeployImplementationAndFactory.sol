// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// scripts/DeployImplementationAndFactory.sol

import "forge-std/Script.sol";
import "../contracts/FlashLoanArbitrageOptimized.sol";
import "../contracts/FlashLoanArbitrageFactory.sol";

contract DeployImplementationAndFactory is Script {
    function run() external {
        // Cargar variables desde .env
        address admin = vm.envAddress("DEPLOYER_ADDRESS");

        // Validar que no estén en blanco
        require(admin != address(0), "DEPLOYER_ADDRESS invalid");

        vm.startBroadcast();

        // Desplegar implementación (sin parámetros)
        FlashLoanArbitrageOptimized implementation = new FlashLoanArbitrageOptimized();
        console.log("Implementation deployed at:", address(implementation));

        // Desplegar fábrica con admin explícito como owner
        FlashLoanArbitrageFactory factory = new FlashLoanArbitrageFactory(
            admin,                   
            address(implementation) 
        );
        console.log("Factory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
