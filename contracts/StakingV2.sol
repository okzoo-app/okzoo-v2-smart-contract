// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// OpenZeppelin upgradeable libraries for access control, safety, and security
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

// Interfaces for external type definitions and custom errors
import {IStakingV2} from "./interfaces/IStakingV2.sol";
import {IStakingV2Errors} from "./interfaces/errors/IStakingV2Errors.sol";

/**
 * @title StakingV2
 * @dev A time-based staking contract with linear reward distribution and lock duration.
 *      Users can stake tokens, earn proportional rewards, and withdraw after a lock period.
 */
contract StakingV2 is
    IStakingV2,
    IStakingV2Errors,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Token being staked
    IERC20Upgradeable public stakedToken;

    // Reward token distributed to stakers
    IERC20Upgradeable public rewardToken;

    // Timestamp when the contract was paused
    uint256 public pausedAt;

    // Total reward allocated for the campaign
    uint256 public totalReward;

    // Campaign start and end timestamps
    uint256 public startTime;
    uint256 public endTime;

    // Lock duration for each stake (in seconds)
    uint256 public lockDuration;

    // Maximum total staked amount allowed
    uint256 public maxActiveStake;

    // Minimum stake amount required to participate
    uint256 public minStakeAmount;

    // Maximum number of stakes allowed per user
    uint256 public maxStakePerUser;

    // Total currently staked amount
    uint256 public totalStaked;

    // Accumulated reward per token (scaled by PRECISION)
    uint256 public accRewardPerToken;

    // Linear reward emission rate per second
    uint256 public rewardPerSecond;

    // Last timestamp when rewards were updated
    uint256 public lastUpdateTime;

    // Precision for decimal calculations (1e18)
    uint256 public constant PRECISION = 1e18;

    // Mapping of user address to list of their stakes
    mapping(address => StakeInfo[]) public userStakes;

    // Use for emergency withdraw
    bool public isEmergencyWithdraw;

    /**
     * @notice Initialize the contract with required parameters.
     * @param _owner Address of the contract owner.
     * @param _stakedToken Address of the token to be staked.
     * @param _rewardToken Address of the token used for rewards.
     * @param _totalReward Total amount of reward tokens available for distribution.
     * @param _startTime Start time of the staking campaign (in seconds since epoch).
     * @param _endTime End time of the staking campaign (in seconds since epoch).
     * @param _lockDuration Duration for which staked tokens are locked (in seconds).
     * @param _maxActiveStake Maximum total amount of tokens that can be staked at any time.
     * @param _maxStakePerUser Maximum number of stakes allowed per user.
     * @dev This function can only be called once during contract deployment.
     */
    function initialize(
        address _owner,
        address _stakedToken,
        address _rewardToken,
        uint256 _totalReward,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _lockDuration,
        uint256 _maxActiveStake,
        uint256 _minStakeAmount,
        uint256 _maxStakePerUser
    ) public initializer {
        if (_startTime >= _endTime) revert InvalidTime();

        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        transferOwnership(_owner);

        stakedToken = IERC20Upgradeable(_stakedToken);
        rewardToken = IERC20Upgradeable(_rewardToken);
        totalReward = _totalReward;
        startTime = _startTime;
        endTime = _endTime;
        lockDuration = _lockDuration;
        maxActiveStake = _maxActiveStake;
        minStakeAmount = _minStakeAmount;
        maxStakePerUser = _maxStakePerUser;

        rewardPerSecond = _totalReward / (_endTime - _startTime);
        lastUpdateTime = _startTime;
    }

    /**
     * @dev Modifier to update global reward accounting before state-changing actions.
     * It calculates the accumulated reward per token based on the elapsed time since the last update.
     * It ensures that rewards are only updated if there are tokens staked and the current time is after the last update.
     */
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

    /**
     * @notice Enable or disable emergency withdrawal mode.
     * @param _value Boolean indicating whether emergency withdrawal is enabled.
     * @dev This function allows the owner to set the emergency withdrawal flag.
     * It can only be called when the contract is paused.
     */
    function setIsEmergencyWithdraw(bool _value) external onlyOwner whenPaused {
        isEmergencyWithdraw = _value;
        emit SetIsEmergencyWithdraw(_value);
    }

    /**************************|
    |         Pausable         |
    |_________________________*/

    /**
     * @dev Modifier to automatically unpause if 12 hours have passed since pause.
     */
    modifier autoUnpause() {
        if (paused() && block.timestamp >= pausedAt + 12 hours) {
            _unpause();
        }
        _;
    }

    /**
     * @dev Allows the contract owner to pause staking operations.
     */
    function pause() external onlyOwner {
        _pause();
        pausedAt = block.timestamp;
    }

    /**
     * @dev Allows the contract owner to unpause staking operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Stake tokens into the contract.
     * @param amount Amount of tokens to stake.
     * @dev This function allows users to stake a specified amount of tokens.
     * It checks if the user has reached the maximum number of stakes, if the staking period is valid,
     * and if the total staked amount does not exceed the maximum allowed.
     * It transfers the staked tokens from the user to the contract and records the stake information.
     * Emits a Staked event upon successful staking.
     * @custom:error TooManyStakes If the user has reached the maximum number of stakes.
     * @custom:error NotInStakingPeriod If the current time is not within the staking period.
     * @custom:error MaxStakeReached If the total staked amount exceeds the maximum allowed.
     */
    function stake(uint256 amount) external nonReentrant autoUnpause whenNotPaused updateReward {
        if (userStakes[msg.sender].length >= maxStakePerUser) revert TooManyStakes();
        if (block.timestamp < startTime || block.timestamp > endTime) revert NotInStakingPeriod();
        if (totalStaked + amount > maxActiveStake) revert MaxStakeReached();
        if (amount < minStakeAmount) revert InvalidAmount();

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

        emit Staked(
            msg.sender,
            amount,
            userStakes[msg.sender].length - 1,
            block.timestamp,
            unlockTime,
            rewardDebt,
            accRewardPerToken
        );
    }

    /**
     * @notice Unstake a specific stake and optionally claim rewards.
     * @param stakeId Index of the stake in user's stake list.
     * @dev This function allows users to unstake their tokens after the lock period.
     * It checks if the stake ID is valid, if the stake has not been claimed yet,
     * and if the unlock time has passed. If the conditions are met, it transfers the staked tokens back to the user.
     * If the unlock time has passed, it calculates the reward based on the accumulated reward per token,
     * and transfers the reward tokens to the user. The stake is marked as claimed to prevent double withdrawal.
     * Emits an Unstaked event upon successful unstaking.
     * @custom:error InvalidStakeId If the provided stake ID is out of bounds.
     * @custom:error AlreadyClaimed If the stake has already been claimed.
     */
    function unstake(uint256 stakeId) external nonReentrant autoUnpause whenNotPaused updateReward {
        if (stakeId >= userStakes[msg.sender].length) revert InvalidStakeId();

        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        if (stakeInfo.claimed) revert AlreadyClaimed();

        stakeInfo.claimed = true;
        totalStaked -= stakeInfo.amount;

        uint256 reward = 0;

        if (block.timestamp >= stakeInfo.unlockTime) {
            uint256 accumulated = (stakeInfo.amount * accRewardPerToken) / PRECISION;
            reward = accumulated > stakeInfo.rewardDebt ? accumulated - stakeInfo.rewardDebt : 0;
            rewardToken.safeTransfer(msg.sender, reward);
        }

        stakedToken.safeTransfer(msg.sender, stakeInfo.amount);
        emit Unstaked(msg.sender, stakeInfo.amount, reward, stakeId, accRewardPerToken);
    }

    /**
     * @dev Emergency Withdraw staked tokens and unstaked requests
     * @notice Can only be called when isEmergencyWithdraw lag is true
     */
    function emergencyWithdraw() external nonReentrant whenPaused {
        if (!isEmergencyWithdraw) {
            revert NotEmergencyWithdraw();
        }

        uint256 stakedAmount = 0;

        StakeInfo[] storage stakes = userStakes[msg.sender];
        for (uint256 i = 0; i < stakes.length; i++) {
            StakeInfo storage stakeInfo = stakes[i];
            if (!stakeInfo.claimed) {
                stakedAmount += stakeInfo.amount;
                stakeInfo.claimed = true; // Mark as claimed to prevent double withdrawal
            }
        }
        if (stakedAmount == 0) {
            revert InsufficientStakedAmount();
        }
        totalStaked -= stakedAmount;
        stakedToken.safeTransfer(msg.sender, stakedAmount);

        emit EmergencyWithdrawn(msg.sender, stakedAmount);
    }

    /**
     * @notice Withdraw tokens from the contract.
     * @param token Address of the token to withdraw.
     * @param to Address to receive the withdrawn tokens.
     * @param amount Amount of tokens to withdraw.
     * @dev This function allows the owner to withdraw tokens from the contract.
     * It checks if the amount is valid and if the token is the staked token, it ensures that
     * the amount does not exceed the available balance minus total staked amount.
     * Emits a Withdrawn event upon successful withdrawal.
     * @custom:error InvalidAmount If the withdrawal amount is zero.
     * @custom:error InsufficientBalance If trying to withdraw more than available balance.
     */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (token == address(stakedToken) && amount > stakedToken.balanceOf(address(this)) - totalStaked) {
            revert InsufficientBalance();
        }
        IERC20Upgradeable(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /**
     * @notice View the stake details of a specific user.
     * @param user Address of the user whose stakes are being queried.
     * @return An array of StakeInfo structures containing details of each stake.
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }

    /**
     * @dev Utility function to return the smaller of two values.
     */
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
