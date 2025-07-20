// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/FlashLoanArbitrageOptimized.sol";
import "../contracts/interfaces/IMinimalPoolProvider.sol";


contract FlashLoanArbitrageOptimizedTest is Test {
    FlashLoanArbitrageOptimized arbitrage;

    address admin = address(0xABCD);
    address[] routersV2;
    address[] routersV3;

    function setUp() public {
        // Despliega el contrato fresh para pruebas unitarias
        arbitrage = new FlashLoanArbitrageOptimized();

        // Configura routers de ejemplo (pueden ser direcciones mock)
        routersV2.push(address(0x1));
        routersV3.push(address(0x2));
    }

    function test_InitializeSuccess() public {
        // Inicializa con admin y routers
        arbitrage.initialize(admin, routersV2, routersV3);

        // Asegurar que el admin tiene DEFAULT_ADMIN_ROLE
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        bool isAdmin = arbitrage.hasRole(DEFAULT_ADMIN_ROLE, admin);
        assertTrue(isAdmin, "Admin must have DEFAULT_ADMIN_ROLE");

        // Confirmar el estado initialized es true
        bool init = arbitrage.initialized();
        assertTrue(init, "Contract should be initialized");
    }

    function test_CannotReinitialize() public {
        arbitrage.initialize(admin, routersV2, routersV3);

        vm.expectRevert(abi.encodeWithSignature("AlreadyInitialized()"));
        arbitrage.initialize(admin, routersV2, routersV3);
    }
}

