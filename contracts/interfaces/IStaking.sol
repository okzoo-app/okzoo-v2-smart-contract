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

    event Claimed(address indexed user, bytes32 indexed unstakeRequestId, uint256 amount, uint256 reward);
    event EmergencyWithdrawn(address indexed user, uint256 amount);
    event UnstakeLockTimeChanged(uint256 oldUnstakeLockTime, uint256 newUnstakeLockTime);
    event SetIsEmergencyWithdraw(bool emergencyWithdraw);

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
        uint256 _maxCap,
        uint256 _minStakeAmount,
        Tier[] calldata _tiers,
        LockPeriod[] calldata _lockPeriods
    ) external;

    function getTier(uint256 amount) external view returns (uint256);
    function getAPR(uint256 amount) external view returns (uint256);
    function getPeriodBonus(uint256 daysLocked) external view returns (uint256);

    function pause() external;
    function unpause() external;

    function stake(uint256 amount, uint256 lockPeriod) external;
    function claim(bytes32 stakeRequestId) external;

    // // Getters
    // function stakeToken() external view returns (IERC20Upgradeable);

    // function unstakeLockTime() external view returns (uint256);

    // function totalStaked() external view returns (uint256);

    // function stakedAmount(address user) external view returns (uint256);

    // function getUserUnstakeRequests(address _user) external view returns (bytes32[] memory);
}
