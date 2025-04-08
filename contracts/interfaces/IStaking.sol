// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IStaking {
    struct Tier {
        uint256 minStake;
        uint256 maxStake;
        uint256 baseAPR;
    }
    struct LockPeriod {
        uint256 daysLocked;
        uint256 aprBonus;
    }

    event Staked(address indexed user, bytes32 indexed stakeRequestId, uint256 amount, uint256 lockPeriod);
    event Claimed(address indexed user, bytes32 indexed stakeRequestId, uint256 amount, uint256 reward);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    event EmergencyWithdrawn(address indexed user, uint256 amount);
    event SetIsEmergencyWithdraw(bool emergencyWithdraw);

    struct StakeEvent {
        uint256 time;
        uint256 amount;
        bool isStart;
    }

    struct StakeRequest {
        address owner;
        uint256 amount;
        uint256 lockPeriod;
        uint256 stakeTime;
        uint256 unLockTime;
        bool claimed;
    }

    function initialize(
        address _owner,
        address _stakeToken,
        address _rewardToken,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _maxCap,
        uint256 _minStakeAmount,
        Tier[] calldata _tiers,
        LockPeriod[] calldata _lockPeriods
    ) external;

    function setIsEmergencyWithdraw(bool _value) external;

    function getAPR(uint256 amount) external view returns (uint256);

    function getBonusPeriod(uint256 daysLocked) external view returns (uint256);

    function pause() external;

    function unpause() external;

    function stake(uint256 amount, uint256 lockPeriod) external;

    function claim(bytes32 stakeRequestId) external;

    function withdraw(address token, address to, uint256 amount) external;

    function emergencyWithdraw() external;

    function getUserStakeRequests(address _user) external view returns (bytes32[] memory);

    function getUserStakeEvents(address _user) external view returns (StakeEvent[] memory);

    function getReward(bytes32 stakeRequestId) external view returns (uint256);
}
