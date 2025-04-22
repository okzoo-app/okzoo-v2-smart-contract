// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.17;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OkzooToken is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 mintAmount,
        address recipient
    ) ERC20(name_, symbol_) {
        _mint(recipient, mintAmount * 10 ** decimals());
    }
}
