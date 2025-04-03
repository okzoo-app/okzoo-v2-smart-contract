// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IStakingErrors} from "./interfaces/errors/IStakingErrors.sol";
import {IStaking} from "./interfaces/IStaking.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

/**
 * @title Staking Contract
 * @dev Implements staking functionality with tiers, lock periods, and reward distribution.
 */
contract Staking is IStaking, IStakingErrors, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    uint256 private constant ONE_DAY = 60; //TODO: change to 1 days

    // uint256 public constant MAXIMUM_STAKE_REQUESTS = 15;
    uint256 public maxCap; // Maximum staking cap
    uint256 public minStakeAmount; // Minimum amount allowed to stake

    IERC20Upgradeable public stakeToken; // ERC20 token used for staking
    IERC20Upgradeable public rewardToken; // ERC20 token used for rewards
    uint256 public totalStaked; // Total staked amount

    mapping(uint256 => Tier) public tiers; // Staking tiers
    mapping(uint256 => uint256) public lockPeriods; // Lock period bonuses

    mapping(address => uint256) public stakedAmount; // Tracks user staked amounts
    mapping(bytes32 => StakeRequest) public stakeRequests; // Maps stake requests by ID
    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private userStakeRequests; // Tracks stake request IDs for each user
    mapping(address => StakeEvent[]) private userStakeEvents; // Tracks stake events for each user
    // Use for emergency withdraw
    bool public isEmergencyWithdraw;

    /**
     * @dev Initializes the staking contract.
     */
    function initialize(
        address _owner,
        address _stakeToken,
        address _rewardToken,
        uint256 _maxCap,
        uint256 _minStakeAmount,
        Tier[] calldata _tiers,
        LockPeriod[] calldata _lockPeriods
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        if (_stakeToken == address(0)) {
            revert ZeroAddress();
        }
        stakeToken = IERC20Upgradeable(_stakeToken);
        rewardToken = IERC20Upgradeable(_rewardToken);
        maxCap = _maxCap;
        minStakeAmount = _minStakeAmount;

        transferOwnership(_owner);

        for (uint256 i = 0; i < _tiers.length; i++) {
            if (_tiers[i].maxStake == 0) {
                revert InvalidTier();
            }
            tiers[i] = _tiers[i];
        }
        for (uint256 i = 0; i < _lockPeriods.length; i++) {
            lockPeriods[_lockPeriods[i].daysLocked] = _lockPeriods[i].aprBonus;
        }
    }

    /**************************|
    |          Setters         |
    |_________________________*/

    /**
     * @dev Set the emergency unstake
     * @param _value The new emergency unstake
     */
    function setIsEmergencyWithdraw(bool _value) external onlyOwner whenPaused {
        isEmergencyWithdraw = _value;
        emit SetIsEmergencyWithdraw(_value);
    }

    /**************************|
    |         Pausable         |
    |_________________________*/

    /**
     * @dev Allows the contract owner to pause staking operations.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Allows the contract owner to unpause staking operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**************************|
    |          Staking         |
    |_________________________*/

    /**
     * @dev Allows a user to stake a specified amount of tokens for a given lock period.
     *      The staked tokens are transferred to the contract, and a new stake request is created.
     *      The request is tracked and used to calculate rewards upon claim.
     *
     * @param amount The amount of tokens the user wants to stake.
     * @param lockPeriod The lock period (in days) for the staked tokens.
     *
     * Requirements:
     * - The staking amount must be greater than `minStakeAmount` and within the `maxCap`.
     * - The contract must not be paused.
     * - The function is protected against reentrancy attacks.
     *
     * Effects:
     * - Transfers `amount` of `stakeToken` from the user to the contract.
     * - Creates a unique stake request using `_hashStakeRequest`.
     * - Records the stake request in `stakeRequests` and links it to the user.
     * - Updates `userStakeRequests` and `userStakeEvents` for reward calculation.
     * - Increments the total staked amount.
     * - Emits a `Staked` event with details of the stake.
     */
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant whenNotPaused {
        // Ensure the staking amount is within the allowed limits
        if (amount < minStakeAmount || totalStaked + amount > maxCap) {
            revert InvalidAmount();
        }

        // Transfer the staking tokens from the user to the contract
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        // Generate a unique ID for the stake request
        bytes32 stakeRequestId = _hashStakeRequest(msg.sender, amount);

        // Create the stake request object
        StakeRequest memory stakeRequest = StakeRequest({
            owner: msg.sender,
            amount: amount,
            lockPeriod: lockPeriod,
            stakeTime: block.timestamp,
            unLockTime: block.timestamp + lockPeriod * ONE_DAY,
            claimed: false
        });

        // Store the stake request
        stakeRequests[stakeRequestId] = stakeRequest;

        // Track the user's stake requests
        userStakeRequests[msg.sender].add(stakeRequestId);

        // Add the stake to the user's staking history (used for reward calculations)
        userStakeEvents[msg.sender].push(StakeEvent(stakeRequest.stakeTime, stakeRequest.amount, true));
        userStakeEvents[msg.sender].push(StakeEvent(stakeRequest.unLockTime, stakeRequest.amount, false));

        // Update the user's and the contract's total staked amount
        stakedAmount[msg.sender] += amount;
        totalStaked += amount;

        // Emit an event to log the staking action
        emit Staked(msg.sender, stakeRequestId, amount, lockPeriod);
    }

    /**
     * @dev Allows a user to claim their staked tokens and potential rewards.
     *      Users can only claim their stake after at least 1/4 of the lock period has passed.
     *      If the lock period has fully ended, rewards will be included in the claim.
     *
     * @param stakeRequestId The unique identifier of the stake request being claimed.
     *
     * Requirements:
     * - The caller must be the owner of the stake request.
     * - The stake request must not have been claimed already.
     * - The current time must be at least (unlockTime - 1/4 of the lock period).
     *
     * Effects:
     * - If the lock period has ended, calculates and adds rewards to the claimable amount.
     * - Transfers the staked amount (and rewards, if applicable) to the user.
     * - Marks the stake request as claimed.
     * - Emits a `Claimed` event with details of the claim.
     */
    function claim(bytes32 stakeRequestId) external nonReentrant whenNotPaused {
        // Retrieve the stake request
        StakeRequest memory stakeRequest = stakeRequests[stakeRequestId];

        // Ensure that the caller is the owner of the stake request
        if (stakeRequest.owner != msg.sender) {
            revert NotRequestOwner();
        }

        // Ensure the stake request has not been claimed already
        if (stakeRequest.claimed) {
            revert AlreadyClaimed();
        }

        // Ensure the claim is being made after at least 1/4 of the lock period has passed
        if (block.timestamp < stakeRequest.unLockTime - (stakeRequest.unLockTime - stakeRequest.stakeTime) / 4) {
            revert NotClaimTime();
        }

        stakedAmount[msg.sender] -= stakeRequest.amount;
        totalStaked -= stakeRequest.amount;

        // Remove the stake request from the user's list
        userStakeRequests[msg.sender].remove(stakeRequestId);

        // If the full lock period has passed, calculate and add the staking rewards
        uint256 totalReward = block.timestamp > stakeRequest.unLockTime ? _calculateReward(stakeRequest) : 0;

        // Transfer the claimed amount (principal + rewards) to the user
        rewardToken.safeTransfer(stakeRequest.owner, stakeRequest.amount + totalReward);
        // stakedAmount[stakeRequest.owner] -= stakeRequest.amount;

        // Mark the stake request as claimed
        stakeRequests[stakeRequestId].claimed = true;

        // Emit an event logging the claim details
        emit Claimed(msg.sender, stakeRequestId, stakeRequest.amount, totalReward);
    }

    /**
     * @dev Emergency Withdraw staked tokens and unstaked requests
     * @notice Can only be called when isEmergencyWithdraw lag is true
     */
    function emergencyWithdraw() external nonReentrant whenPaused {
        if (!isEmergencyWithdraw) {
            revert NotEmergencyWithdraw();
        }

        // Withdraw staking amount
        uint256 claimAmount = stakedAmount[msg.sender];
        stakedAmount[msg.sender] = 0;
        totalStaked -= claimAmount;

        bytes32[] memory stakeRequestIds = getUserStakeRequests(msg.sender);
        // Withdraw all unstake requests
        for (uint256 i; i < stakeRequestIds.length; i++) {
            bytes32 unstakeRequestId = stakeRequestIds[i];

            stakeRequests[unstakeRequestId].claimed = true;

            userStakeRequests[msg.sender].remove(unstakeRequestId);
        }

        if (claimAmount == 0) {
            revert InsufficientStakedAmount();
        }

        stakeToken.safeTransfer(msg.sender, claimAmount);

        emit EmergencyWithdrawn(msg.sender, claimAmount);
    }

    /**************************|
    |          Getters         |
    |_________________________*/

    /**
     * @dev Returns the APR for a given stake amount.
     */
    function getAPR(uint256 amount) external view returns (uint256) {
        return _getAPR(amount);
    }

    /**
     * @dev Returns the bonus APR for a given lock period.
     */
    function getPeriodBonus(uint256 daysLocked) external view returns (uint256) {
        return lockPeriods[daysLocked];
    }

    /**
     * @dev Get available stake request
     * @param _user The user address
     */
    function getUserStakeRequests(address _user) public view returns (bytes32[] memory) {
        return userStakeRequests[_user].values();
    }

    /**
     * @dev Returns a list of user stake ranges.
     * @param _user The user address
     */
    function getUserStakeEvents(address _user) public view returns (StakeEvent[] memory) {
        return userStakeEvents[_user];
    }

    /**
     * @dev Retrieves the total reward for a specific stake request identified by `stakeRequestId`.
     *      It calculates the reward based on the stake request details such as the stake amount,
     *      stake time, unlock time, and any other relevant parameters using the `_calculateReward` function.
     *
     * @param stakeRequestId The unique identifier for the stake request whose reward is to be calculated.
     *
     * @return uint256 The total reward calculated for the given stake request.
     */
    function getReward(bytes32 stakeRequestId) external view returns (uint256) {
        // Retrieve the stake request details using the stakeRequestId
        StakeRequest memory stakeRequest = stakeRequests[stakeRequestId];

        // Calculate and return the reward based on the stake request details
        return _calculateReward(stakeRequest);
    }

    /**************************|
    |         Internals        |
    |_________________________*/

    /**
     * @dev Calculates the total reward for a given stake request based on the staking history.
     *      The function processes stake events, determines active stake amounts over time,
     *      and computes rewards accordingly.
     *
     * @param claimRequest The stake request for which rewards are being calculated.
     * @return totalReward The total reward amount accrued for the given stake request.
     *
     * Logic:
     * - Retrieves all stake-related events for the user (deposits and withdrawals).
     * - Sorts these events in chronological order using `_quickSort`.
     * - Iterates through the sorted events to track the user's active staked amount.
     * - Computes the reward based on the APR and any lock period bonus.
     * - Returns the total calculated reward.
     *
     * Assumptions:
     * - `events` contains all stake start and end times.
     * - APR is calculated dynamically using `_getAPR(currentAmount)`.
     * - Lock period bonuses are applied via `lockPeriods[claimRequest.lockPeriod]`.
     */
    function _calculateReward(StakeRequest memory claimRequest) internal view returns (uint256 totalReward) {
        // Retrieve staking history events for the user
        StakeEvent[] memory events = userStakeEvents[claimRequest.owner];

        // Sort stake events chronologically
        events = _sortEvents(events);

        uint256 currentAmount = 0; // Tracks the user's active staked amount
        uint256 prevTime = events[0].time; // Tracks the previous event time

        // Iterate through sorted stake events
        for (uint256 i = 0; i < events.length; i++) {
            if (events[i].time != prevTime) {
                // Only calculate rewards within the stake request period
                if (prevTime >= claimRequest.stakeTime && events[i].time <= claimRequest.unLockTime) {
                    uint256 apr = _getAPR(currentAmount); // Get APR for the current stake amount
                    uint256 bonusPeriod = lockPeriods[claimRequest.lockPeriod]; // Get bonus APR for lock period

                    // Reward calculation: (amount * (APR + bonus) * duration) / (100 * 365 * ONE_DAY)
                    totalReward +=
                        (currentAmount * (apr + bonusPeriod) * (events[i].time - prevTime)) /
                        100 /
                        365 /
                        ONE_DAY;
                }
                prevTime = events[i].time; // Update the previous event time
            }

            // Update the active staked amount based on event type
            if (events[i].isStart) {
                currentAmount += events[i].amount; // Increase stake amount
            } else {
                currentAmount -= events[i].amount; // Decrease stake amount
            }
        }

        return totalReward;
    }

    /**
     * @dev Sorts an array of StakeEvent events based on the following criteria:
     *      1. Sort by `time` in ascending order.
     *      2. If two events have the same `time`, prioritize events where `isStart` is true over those where `isStart` is false.
     *
     * This is a bubble sort implementation, which iterates over the array multiple times and swaps elements to sort the events.
     * The time complexity of this function is O(n^2) due to the nested loops.
     *
     * @param events The array of StakeEvent events to be sorted.
     * @return The sorted array of StakeEvent events.
     */
    function _sortEvents(StakeEvent[] memory events) internal pure returns (StakeEvent[] memory) {
        uint256 n = events.length;
        // Outer loop for each pass over the events array.
        for (uint256 i = 0; i < n; i++) {
            // Inner loop for comparing adjacent elements.
            for (uint256 j = 0; j < n - 1; j++) {
                // Check if the current event should be swapped with the next event.
                if (
                    events[j].time > events[j + 1].time || // Sort by time in ascending order.
                    (events[j].time == events[j + 1].time && events[j].isStart && !events[j + 1].isStart) // Prioritize 'isStart' events.
                ) {
                    // Swap the events if the conditions are met.
                    StakeEvent memory temp = events[j];
                    events[j] = events[j + 1];
                    events[j + 1] = temp;
                }
            }
        }
        return events;
    }

    /**
     * @dev Returns the APR for a given stake amount.
     */
    function _getAPR(uint256 amount) internal view returns (uint256) {
        uint256 i = 0;
        while (true) {
            if (tiers[i].maxStake == 0) {
                break;
            }
            if (amount >= tiers[i].minStake && amount < tiers[i].maxStake) {
                return tiers[i].baseAPR;
            }
            i++;
        }
        return 0;
    }

    /**
     * @dev Generates a unique hash for a stake request.
     *
     * This function creates a unique identifier for a stake request by hashing the user's address,
     * the staking amount, and the current block timestamp. The hash can be used to uniquely identify
     * a staking action, ensuring that each stake request is distinct.
     *
     * @param user The address of the user initiating the stake.
     * @param amount The amount of tokens being staked.
     *
     * @return bytes32 A unique hash representing the stake request.
     */
    function _hashStakeRequest(address user, uint256 amount) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(user, amount, block.timestamp));
    }
}
