// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IStaking {
    event Staked(address indexed user, uint256 amount);
    event Unstake(address indexed user, bytes32 indexed unstakeRequestId, uint256 amount, uint256 claimTime);
    event Claimed(address indexed user, bytes32 indexed unstakeRequestId, uint256 amount);
    event EmergencyWithdrawn(address indexed user, uint256 amount);
    event UnstakeLockTimeChanged(uint256 oldUnstakeLockTime, uint256 newUnstakeLockTime);
    event SetIsEmergencyWithdraw(bool emergencyWithdraw);

    struct UnstakeRequest {
        address owner;
        uint256 amount;
        uint256 claimTime;
        bool claimed;
    }

    function initialize(address _stakeToken, uint256 _unstakeLockTime, address _owner) external;

    function setUnstakeLockTime(uint256 _unstakeLockTime) external;

    function setIsEmergencyWithdraw(bool _value) external;

    function pause() external;

    function unpause() external;

    function stake(uint256 amount) external;

    function unstake(uint256 amount) external returns (bytes32 unstakeRequestId);

    function claimMultiple(bytes32[] calldata unstakeRequestIds) external;

    function claim(bytes32 unstakeRequestId) external;

    function emergencyWithdraw() external;

    // Getters
    function stakeToken() external view returns (IERC20Upgradeable);

    function unstakeLockTime() external view returns (uint256);

    function totalStaked() external view returns (uint256);

    function stakedAmount(address user) external view returns (uint256);

    function getUserUnstakeRequests(address _user) external view returns (bytes32[] memory);
}
