// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MockAavePool.sol";
import "../contracts/MockPoolProvider.sol";
import "../contracts/FlashLoanArbitrageOptimized.sol";
import "../contracts/MockERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "../contracts/IMinimalPoolProvider.sol";


contract DeployMocksScript is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 mockUSDC = new MockERC20("MockUSDC", "mUSDC", 6);
        MockERC20 mockWETH = new MockERC20("MockWETH", "mWETH", 18);

        mockUSDC.mint(msg.sender, 1_000_000 * 10 ** 6);
        mockWETH.mint(msg.sender, 1_000_000 ether);

        MockAavePool mockPool = new MockAavePool(payable(address(0)));
        MockPoolProvider mockProvider = new MockPoolProvider(address(mockPool));
        
        // Constructor sin argumentos (como está en Mainnet)
        FlashLoanArbitrageOptimized arbitrage = new FlashLoanArbitrageOptimized();  

        // Inicializar correctamente con admin y routers vacíos
            
        address adminAndOperator = 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720;

        address[] memory routersV2;
        address[] memory routersV3;
        arbitrage.initialize(adminAndOperator, routersV2, routersV3);

        console2.log("ADMIN elegido:", adminAndOperator);
        console2.log("Contrato desplegado en:", address(arbitrage)); 

        mockPool.setTarget(address(arbitrage));

        mockUSDC.approve(address(mockPool), type(uint256).max);
        mockUSDC.mint(address(mockPool), 100_000 * 10 ** 6); // Asegúrate que el mock pool tenga tokens

        console2.log("MOCK USDC:", address(mockUSDC));
        console2.log("MOCK WETH:", address(mockWETH));
        console2.log("Mock Aave Pool:", address(mockPool));
        console2.log("Mock Pool Provider:", address(mockProvider));
        console2.log("FlashLoanArbitrageOptimized:", address(arbitrage));

        vm.stopBroadcast();
    }
}