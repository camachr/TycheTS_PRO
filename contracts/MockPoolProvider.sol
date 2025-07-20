// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMinimalPoolProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPoolProvider is IMinimalPoolProvider {
    address public pool;

    constructor(address _pool) {
        pool = _pool;
    }

    function getPool() external view override returns (address) {
        return pool;
    }

    function setPool(address _newPool) external {
        pool = _newPool;
    }

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
    require(params.amountIn > 0, "Invalid input amount");
    require(IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn), "TransferFrom failed");

    // 💰 Simular ganancia del 1%
    uint256 mockRate = 101e16; // 1.01 en base 1e18
    amountOut = (params.amountIn * mockRate) / 1e18;

    require(amountOut >= params.amountOutMinimum, "Slippage too high");

    require(IERC20(params.tokenOut).transfer(params.recipient, amountOut), "Transfer failed");
    }

}
