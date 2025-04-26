// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOkzooSwap {
    struct User {
        uint256 totalClaimed;
    }

    struct UserSwap {
        address user;
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 claimTime;
        bool claimed;
    }

    struct SwapRequest {
        address user;
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 swapLockTime;
        bytes32 swapRequestId;
        uint256 deadline;
        uint256 nonce;
    }

    struct ClaimRequest {
        address user;
        bytes32 swapRequestId;
        uint256 deadline;
        uint256 nonce;
    }

    event VerifierChanged(address indexed newVerifier);
    event Swapped(
        address indexed user,
        uint256 inputAmount,
        uint256 outputAmount,
        bytes32 swapRequestId,
        uint256 claimTime
    );
    event Claimed(address indexed user, bytes32 swapRequestId);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    function swap(
        uint256 _inputAmount,
        uint256 _outputAmount,
        uint256 _swapLockTime,
        bytes32 _swapRequestId,
        uint256 _deadline,
        bytes memory _signature
    ) external;

    function claim(bytes32 _swapRequestId, uint256 _deadline, bytes memory _signature) external;

    function nonces(address owner) external view returns (uint256);

    function getUserSwapRequests(address user) external view returns (bytes32[] memory);
}
