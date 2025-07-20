// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FlashLoanArbitrageOptimized.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAavePool {
    using SafeERC20 for IERC20;

    event DebugStep(string step, address asset, uint256 amount, uint256 balance);

    address payable public flashloanTarget;

    constructor(address payable _target) {
        flashloanTarget = _target;
    }

    function setTarget(address _newTarget) external {
        flashloanTarget = payable(_newTarget);
    }

    function flashLoanSimple(
    address, // receiverAddress (no usado en mock)
    address asset,
    uint256 amount,
    bytes calldata params,
    uint16 // referralCode (no usado en mock)
) external {
    emit DebugStep("before-transfer", asset, amount, IERC20(asset).balanceOf(address(this)));

    // Transferir el préstamo al contrato de arbitraje
    IERC20(asset).safeTransfer(flashloanTarget, amount);
    emit DebugStep("after-transfer", asset, amount, IERC20(asset).balanceOf(address(this)));

    uint256 premium = (amount * 9) / 10000;
    emit DebugStep("before-executeOperation", asset, amount, IERC20(asset).balanceOf(flashloanTarget));

    // Declarar correctamente los arrays
    address[] memory assets = new address[](1);
    uint256[] memory amounts = new uint256[](1);
    uint256[] memory premiums = new uint256[](1);

    assets[0] = asset;
    amounts[0] = amount;
    premiums[0] = premium;

    // Llamar al contrato principal como lo haría Aave
    FlashLoanArbitrageOptimized(flashloanTarget).executeOperation(
        assets,
        amounts,
        premiums,
        address(this),
        params
    );

    emit DebugStep("after-executeOperation", asset, amount, IERC20(asset).balanceOf(flashloanTarget));

    // Verificar repago
    uint256 totalDue = amount + premium;
    uint256 received = IERC20(asset).balanceOf(address(this));
    require(received >= totalDue, "Flash loan not repaid with premium");
}

    function fund(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function approveToken(address token, address spender) external {
        IERC20(token).approve(spender, type(uint256).max);
    }
}
