// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IStakingV2 {
    struct StakeInfo {
        uint256 amount;
        uint256 stakeTime;
        uint256 unlockTime;
        uint256 rewardDebt;
        bool claimed;
    }

    event Staked(address indexed user, uint256 amount, uint256 stakeId);
    event Unstaked(address indexed user, uint256 amount, uint256 reward, uint256 stakeId);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    event EmergencyWithdrawn(address indexed user, uint256 amount);
    event SetIsEmergencyWithdraw(bool emergencyWithdraw);

    function initialize(
        address _stakedToken,
        address _rewardToken,
        uint256 _totalReward,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _lockDuration,
        uint256 _maxActiveStake,
        uint256 _maxStakePerUser
    ) external;

    function setIsEmergencyWithdraw(bool _value) external;

    function pause() external;

    function unpause() external;

    function stake(uint256 amount) external;

    function unstake(uint256 stakeId) external;

    function getUserStakes(address user) external view returns (StakeInfo[] memory);
}
