// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IOkzooV2Errors {
    error AlreadyCheckin();
    error StreakMilestoneNotReached();
    error MustClaimBonusBeforeCheckin();
    error AlreadyAtHighestStage();
    error AlreadyEvolved();
    error InvalidSignature();
    error DeadlinePassed();
    error ZeroAddress();
}
