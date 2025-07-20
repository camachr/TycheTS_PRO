// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MockAavePool.sol";
import "../contracts/MockPoolProvider.sol";
import "../contracts/FlashLoanArbitrageOptimized.sol";
import "../contracts/MockERC20.sol";

contract DeployMocks is Test {
    MockAavePool public mockPool;
    MockPoolProvider public mockProvider;
    FlashLoanArbitrageOptimized public arbitrage;
    MockERC20 public mockUSDC;
    MockERC20 public mockWETH;

    function setUp() public {
        // Deploy Mock Tokens
        mockUSDC = new MockERC20("MockUSDC", "mUSDC");
        mockWETH = new MockERC20("MockWETH", "mWETH");

        // Mint tokens
        mockUSDC.mint(address(this), 1_000_000 * 10 ** 6);
        mockWETH.mint(address(this), 1_000_000 ether);

        // Deploy Mocks
        mockPool = new MockAavePool(payable(address(0)));
        mockProvider = new MockPoolProvider(address(mockPool));

constructor(address _provider) {
    poolProvider = IMinimalPoolProvider(_provider);
}

        mockPool.setTarget(address(arbitrage));

        // Fund MockAavePool with USDC
        mockUSDC.approve(address(mockPool), type(uint256).max);
        mockPool.fund(address(mockUSDC), 10_000 * 10 ** 6);
    }
}
