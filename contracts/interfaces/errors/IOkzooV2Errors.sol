// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOkzooV2Errors {
    error AlreadyCheckin();
    error NoBonusAvailable();
    error UserDoesNotExist();
    error MustClaimBonusBeforeCheckin();
    error AlreadyAtHighestStage();
    error InvalidSignature();
    error DeadlinePassed();
    error ZeroAddress();
}
