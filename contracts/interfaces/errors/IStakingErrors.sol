// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IStakingErrors {
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientStakedAmount();
    error InsufficientBalance();
    error NotRequestOwner();
    error AlreadyClaimed();
    error NotStakeTime();
    error NotClaimTime();
    error NotEmergencyWithdraw();

    error InvalidTier();
    error InvalidBaseAPR();
    error InvalidLockPeriod();
}
