// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// contracts/FlashLoanArbitrageFactory.sol

import "./FlashLoanArbitrageOptimized.sol";
import "lib/openzeppelin-contracts/contracts/proxy/Clones.sol";

contract FlashLoanArbitrageFactory {
    address public immutable owner;
    address public immutable implementation;

    event CloneCreated(address indexed clone, address indexed admin);

    constructor(address _owner, address _implementation) {
        require(_owner != address(0), "Invalid owner");
        require(_implementation != address(0), "Invalid implementation");
        owner = _owner;
        implementation = _implementation;
    }

    function createClone(
        address admin,
        address[] memory routersV2,
        address[] memory routersV3
    ) external returns (address clone) {
        require(admin != address(0), "Invalid admin");

        clone = Clones.clone(implementation);

        // Inicializa el clon con roles y routers
        FlashLoanArbitrageOptimized(clone).initialize(admin, routersV2, routersV3);

        emit CloneCreated(clone, admin);
    }
}
