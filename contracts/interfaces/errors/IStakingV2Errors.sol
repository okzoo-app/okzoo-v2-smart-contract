// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IStakingV2Errors {
    error InvalidTime();
    error NotInStakingPeriod();
    error MaxStakeReached();
    error AlreadyClaimed();
    error NotEmergencyWithdraw();
    error InsufficientStakedAmount();
    error InvalidStakeId();
    error TooManyStakes();
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientBalance();
}
