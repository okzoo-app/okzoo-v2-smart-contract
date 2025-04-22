// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOkzooSwapErrors {
    error UserDoesNotExist();
    error DeadlinePassed();
    error InvalidUser();
    error InvalidSignature();
    error ZeroAddress();
    error AlreadyClaimed();
    error ClaimTimeNotReached();
}
