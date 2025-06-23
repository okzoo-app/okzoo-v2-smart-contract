// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DynamicAPRStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct StakeInfo {
        uint256 amount;
        uint256 stakeTime;
        uint256 unlockTime;
        uint256 rewardDebt;
        bool claimed;
    }

    IERC20 public stakedToken;
    IERC20 public rewardToken;

    uint256 public totalReward;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public lockDuration;
    uint256 public maxActiveStake;

    uint256 public totalStaked;
    uint256 public accRewardPerToken;
    uint256 public rewardPerSecond;
    uint256 public lastUpdateTime;

    uint256 public constant PRECISION = 1e18;

    mapping(address => StakeInfo[]) public userStakes;

    event Staked(address indexed user, uint256 amount, uint256 stakeId);
    event Unstaked(address indexed user, uint256 amount, uint256 reward, uint256 stakeId);

    constructor(
        address _stakedToken,
        address _rewardToken,
        uint256 _totalReward,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _lockDuration,
        uint256 _maxActiveStake
    ) {
        require(_startTime < _endTime, "Invalid time");

        stakedToken = IERC20(_stakedToken);
        rewardToken = IERC20(_rewardToken);
        totalReward = _totalReward;
        startTime = _startTime;
        endTime = _endTime;
        lockDuration = _lockDuration;
        maxActiveStake = _maxActiveStake;

        rewardPerSecond = _totalReward / (_endTime - _startTime);
        lastUpdateTime = _startTime;
    }

    modifier updateReward() {
        uint256 currentTime = block.timestamp;
        if (currentTime > lastUpdateTime && totalStaked > 0) {
            uint256 elapsed = _min(currentTime, endTime) - lastUpdateTime;
            uint256 reward = elapsed * rewardPerSecond;
            accRewardPerToken += (reward * PRECISION) / totalStaked;
        }
        lastUpdateTime = _min(currentTime, endTime);
        _;
    }

    function stake(uint256 amount) external updateReward {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "Not in staking period");
        require(totalStaked + amount <= maxActiveStake, "Max stake reached");

        stakedToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 rewardDebt = (amount * accRewardPerToken) / PRECISION;
        uint256 unlockTime = block.timestamp + lockDuration;

        userStakes[msg.sender].push(
            StakeInfo({
                amount: amount,
                stakeTime: block.timestamp,
                unlockTime: unlockTime,
                rewardDebt: rewardDebt,
                claimed: false
            })
        );

        totalStaked += amount;

        emit Staked(msg.sender, amount, userStakes[msg.sender].length - 1);
    }

    function unstake(uint256 stakeId) external updateReward {
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        require(!stakeInfo.claimed, "Already claimed");

        stakeInfo.claimed = true;
        totalStaked -= stakeInfo.amount;

        uint256 reward = 0;

        if (block.timestamp >= stakeInfo.unlockTime) {
            uint256 accumulated = (stakeInfo.amount * accRewardPerToken) / PRECISION;
            reward = accumulated > stakeInfo.rewardDebt ? accumulated - stakeInfo.rewardDebt : 0;
            rewardToken.safeTransfer(msg.sender, reward);
        }

        stakedToken.safeTransfer(msg.sender, stakeInfo.amount);
        emit Unstaked(msg.sender, stakeInfo.amount, reward, stakeId);
    }

    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
