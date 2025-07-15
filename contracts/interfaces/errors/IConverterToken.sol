// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IConverterTokenErrors {
    error NotNftHolder();
    error InvalidAmount();
    error InvalidSignature();
    error DeadlinePassed();
    error InsufficientBalance();
    error CooldownNotOver();
}
