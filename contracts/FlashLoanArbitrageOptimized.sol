// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// contracts/FlashLoanArbitrageOptimized.sol

import "./interfaces/ILendingPool.sol";
import "./interfaces/ILendingPoolAddressesProvider.sol";
import "./interfaces/DataTypes.sol";
import "./interfaces/IFlashLoanReceiver.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "lib/v3-periphery/contracts/interfaces/ISwapRouter.sol";


contract FlashLoanArbitrageOptimized is ReentrancyGuard, AccessControl, IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    event DebugStep(string step, address asset, uint256 amount, uint256 balance);
    event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event TokenWhitelisted(address indexed token, bool whitelisted);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);
    event MaxSlippageUpdated(uint256 oldValue, uint256 newValue, address indexed admin);

    error Unauthorized();
    error InvalidAddress();
    error PausedError();
    error AlreadyInitialized();
    error TokenNotWhitelisted();
    error ArrayLengthMismatch();
    error InsufficientProfit();
    error InsufficientBribe();
    error SlippageTooHigh();
    error InvalidSlippageValue();

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    bool public paused;
    bool public initialized;
    uint256 public maxSlippageBps;
    mapping(address => bool) public tokenWhitelist;
    mapping(address => bool) public isV3Router;

    ILendingPool public constant POOL = ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);

    constructor() {
        // _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        maxSlippageBps = 500;
    }

    function initialize(
        address _admin,
        address[] calldata routersV2,
        address[] calldata routersV3
    ) external {
        if (initialized) revert AlreadyInitialized();
        if (_admin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);

        for (uint i = 0; i < routersV2.length; i++) {
            require(routersV2[i] != address(0), "Invalid V2 router");
            isV3Router[routersV2[i]] = false;
        }
        for (uint i = 0; i < routersV3.length; i++) {
            require(routersV3[i] != address(0), "Invalid V3 router");
            isV3Router[routersV3[i]] = true;
        }

        initialized = true;
    }

    modifier onlyOperator() {
        if (!hasRole(OPERATOR_ROLE, msg.sender)) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    function setMaxSlippageBps(uint256 newSlippage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSlippage > 10000 || newSlippage == 0) revert InvalidSlippageValue();
        emit MaxSlippageUpdated(maxSlippageBps, newSlippage, msg.sender);
        maxSlippageBps = newSlippage;
    }

    function executeFlashLoanAave(
        address asset,
        uint256 amount,
        address[] calldata routers,
        address[] calldata tokensIn,
        address[] calldata tokensOut,
        uint24[] calldata fees,
        uint256 slippageBps,
        uint256 minProfit,
        uint256 mevBribe
    ) external payable onlyOperator whenNotPaused nonReentrant returns (uint256) {
        if (!tokenWhitelist[asset]) revert TokenNotWhitelisted();
        if (
            routers.length != tokensIn.length ||
            routers.length != tokensOut.length ||
            routers.length != fees.length
        ) revert ArrayLengthMismatch();
        if (slippageBps > maxSlippageBps || slippageBps == 0) revert SlippageTooHigh();
        if (msg.value < mevBribe) revert InsufficientBribe();

        bytes memory params = abi.encode(routers, tokensIn, tokensOut, fees, slippageBps);
        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));

        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );

        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        uint256 profit = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;

        if (profit < minProfit) revert InsufficientProfit();

        if (profit > 0) IERC20(asset).safeTransfer(msg.sender, profit);
        if (msg.value > 0) {
            (bool success, ) = payable(msg.sender).call{value: msg.value}("");
            require(success, "Transfer failed");
        }

        return profit;
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override nonReentrant whenNotPaused returns (bool) {
        if (msg.sender != address(POOL)) revert Unauthorized();
        if (initiator != address(this)) revert Unauthorized();
        if (assets.length != 1 || amounts.length != 1 || premiums.length != 1) revert ArrayLengthMismatch();

        (address[] memory routers, address[] memory tokensIn, address[] memory tokensOut, uint24[] memory fees, uint256 slippageBps) =
            abi.decode(params, (address[], address[], address[], uint24[], uint256));

        for (uint i = 0; i < routers.length; i++) {
            _executeSwap(routers[i], tokensIn[i], tokensOut[i], fees[i], slippageBps);
        }

        uint256 totalRepayment = amounts[0] + premiums[0];
        SafeERC20.forceApprove(IERC20(assets[0]), address(POOL), totalRepayment);
        IERC20(assets[0]).safeTransfer(address(POOL), totalRepayment);

        return true;
    }

    function _executeSwap(
        address router,
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 slippageBps
    ) internal {
        if (!tokenWhitelist[tokenIn] || !tokenWhitelist[tokenOut]) revert TokenNotWhitelisted();

        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));

        if (isV3Router[router]) {
            uint256 amountOutMin = (amountIn * (10000 - slippageBps)) / 10000;

            if (IERC20(tokenIn).allowance(address(this), router) < amountIn) {
                SafeERC20.forceApprove(IERC20(tokenIn), router, type(uint256).max);
            }

            uint256 amountOut = ISwapRouter(router).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp + 300,
                    amountIn: amountIn,
                    amountOutMinimum: amountOutMin,
                    sqrtPriceLimitX96: 0
                })
            );

            emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut);
        } else {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;

            uint256[] memory amounts = IUniswapV2Router02(router).getAmountsOut(amountIn, path);
            uint256 amountOutMin = (amounts[1] * (10000 - slippageBps)) / 10000;

            if (IERC20(tokenIn).allowance(address(this), router) < amountIn) {
                IERC20(tokenIn).approve(router, type(uint256).max);
            }

            IUniswapV2Router02(router).swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );

            emit SwapExecuted(tokenIn, tokenOut, amountIn, amounts[1]);
        }
    }

    function addTokenToWhitelist(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        tokenWhitelist[token] = true;
        emit TokenWhitelisted(token, true);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!paused, "Already paused");
        paused = true;
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Not paused");
        paused = false;
        emit ContractUnpaused(msg.sender);
    }

    /**
    * @notice Destruye el contrato y envía los fondos restantes al admin
    * @dev Solo el DEFAULT_ADMIN_ROLE puede ejecutarlo
    */
    function destroyContract() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Transfiere cualquier ETH residual al admin
        selfdestruct(payable(msg.sender));
    }

}