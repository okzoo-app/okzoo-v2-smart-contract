// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IStakingErrors {
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientStakedAmount();
    error InsufficientBalance();
    error InsufficientWithdrawAmount();
    error NotRequestOwner();
    error AlreadyClaimed();
    error NotStakeTime();
    error NotClaimTime();
    error NotEmergencyWithdraw();
    error InvalidTier();
    error InvalidBaseAPR();
    error InvalidLockPeriod();
}
