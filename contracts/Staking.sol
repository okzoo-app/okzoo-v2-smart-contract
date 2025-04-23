// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IStakingErrors} from "./interfaces/errors/IStakingErrors.sol";
import {IStaking} from "./interfaces/IStaking.sol";

/**
 * @title Staking Contract
 * @dev Implements staking functionality with tiers, lock periods, and reward distribution.
 */
contract Staking is IStaking, IStakingErrors, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address payable;

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    uint256 private constant ONE_DAY = 1 days;
    uint256 public pausedAt;

    uint256 public startTime;
    uint256 public endTime;
    uint256 public maxCap; // Maximum staking cap
    uint256 public minStakeAmount; // Minimum amount allowed to stake

    IERC20Upgradeable public stakeToken; // ERC20 token used for staking
    IERC20Upgradeable public rewardToken; // ERC20 token used for rewards
    uint256 public totalStaked; // Total staked amount (includes both active and pending stakes)
    uint256 public totalStaking; // Total staking amount

    mapping(uint256 => Tier) public tiers; // Staking tiers
    mapping(uint256 => uint256) public lockPeriods; // Lock period bonuses
    uint256[] public lockPeriodKeys; // Array of lock period keys

    mapping(address => uint256) public stakingAmount; // Tracks user staked amounts
    mapping(bytes32 => StakeRequest) public stakeRequests; // Maps stake requests by ID
    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private userStakeRequests; // Tracks stake request IDs for each user
    mapping(address => Event[]) private userEvents; // Tracks stake events for each user

    // Use for emergency withdraw
    bool public isEmergencyWithdraw;

    mapping(address => uint256) public nonces;

    /**
     * @dev Initializes the staking contract.
     */
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
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        if (_stakeToken == address(0)) {
            revert ZeroAddress();
        }
        stakeToken = IERC20Upgradeable(_stakeToken);
        rewardToken = IERC20Upgradeable(_rewardToken);
        startTime = _startTime;
        endTime = _endTime;
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
            lockPeriodKeys.push(_lockPeriods[i].daysLocked);
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
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant autoUnpause whenNotPaused {
        // Check if the current time is past the allowed staking period
        if (block.timestamp < startTime || endTime < block.timestamp) {
            revert NotStakeTime();
        }

        // Ensure the staking amount is within the allowed limits
        if (amount < minStakeAmount || totalStaked + amount > maxCap) {
            revert InvalidAmount();
        }

        // Transfer the staking tokens from the user to the contract
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        // Generate a unique ID for the stake request
        bytes32 stakeRequestId = _hashStakeRequest(msg.sender, amount, _useNonce(msg.sender));

        // Create the stake request object
        StakeRequest memory stakeRequest = StakeRequest({
            owner: msg.sender,
            amount: amount,
            lockPeriod: lockPeriod,
            stakeTime: block.timestamp,
            claimed: false
        });

        // Store the stake request
        stakeRequests[stakeRequestId] = stakeRequest;

        // Track the user's stake requests
        userStakeRequests[msg.sender].add(stakeRequestId);

        // Add the stake to the user's staking history (used for reward calculations)
        userEvents[msg.sender].push(Event(stakeRequest.stakeTime, stakeRequest.amount, true));

        // Update the user's and the contract's total staked amount
        stakingAmount[msg.sender] += amount;
        totalStaked += amount;
        totalStaking += amount;

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
    function claim(bytes32 stakeRequestId) external nonReentrant autoUnpause whenNotPaused {
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
        if (block.timestamp < (stakeRequest.stakeTime + (stakeRequest.lockPeriod * ONE_DAY) / 4)) {
            revert NotClaimTime();
        }

        stakingAmount[msg.sender] -= stakeRequest.amount;
        totalStaking -= stakeRequest.amount;

        // Mark the stake request as claimed
        stakeRequests[stakeRequestId].claimed = true;

        // Remove the stake request from the user's list
        userStakeRequests[msg.sender].remove(stakeRequestId);

        userEvents[msg.sender].push(Event(block.timestamp, stakeRequest.amount, false));

        // Transfer the claimed amount (principal + rewards) to the user
        stakeToken.safeTransfer(stakeRequest.owner, stakeRequest.amount);

        // If the full lock period has passed, calculate and add the staking rewards
        uint256 reward = 0;
        if (block.timestamp >= stakeRequest.stakeTime + stakeRequest.lockPeriod * ONE_DAY) {
            reward = _calculateReward(stakeRequest);
            rewardToken.safeTransfer(stakeRequest.owner, reward);
        }

        // Emit an event logging the claim details
        emit Claimed(msg.sender, stakeRequestId, stakeRequest.amount, reward);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(stakeToken) && amount > stakeToken.balanceOf(address(this)) - totalStaking) {
            revert InsufficientWithdrawAmount();
        }

        _paid(token, to, amount);
        emit Withdrawn(token, to, amount);
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
        uint256 claimAmount = stakingAmount[msg.sender];

        if (claimAmount == 0) {
            revert InsufficientStakedAmount();
        }

        stakingAmount[msg.sender] = 0;
        totalStaking -= claimAmount;

        bytes32[] memory stakeRequestIds = getUserStakeRequests(msg.sender);

        // Withdraw all unstake requests
        for (uint256 i; i < stakeRequestIds.length; i++) {
            bytes32 unstakeRequestId = stakeRequestIds[i];

            stakeRequests[unstakeRequestId].claimed = true;

            userStakeRequests[msg.sender].remove(unstakeRequestId);
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
     * @dev Function to get the most recent lock period where daysLocked is less than or equal to input value.
     * @param daysLocked The daysLocked value provided as input.
     * @return The lock period with the closest daysLocked value.
     */
    function getAPRLockPeriod(uint256 daysLocked) external view returns (uint256) {
        if (daysLocked < lockPeriodKeys[0]) {
            return 0; // Return 0 if the input is less than the minimum lock period
        }
        // Loop through the array of lock periods to find the closest lock period
        for (uint256 i; i < lockPeriodKeys.length; i++) {
            if (lockPeriodKeys[i] > daysLocked) {
                return lockPeriods[lockPeriodKeys[i - 1]];
            }
        }
        return 0; // Return 0 if no suitable lock period is found
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
    function getUserEvents(address _user) public view returns (Event[] memory) {
        return userEvents[_user];
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
        Event[] memory events = userEvents[claimRequest.owner];

        uint256 currentAmount = 0; // Tracks the user's active staked amount
        uint256 prevTime = events[0].time; // Tracks the previous event time
        uint256 unlockTime = claimRequest.stakeTime + claimRequest.lockPeriod * ONE_DAY; // Maximum time to check for rewards

        for (uint256 i = 0; i < events.length; i++) {
            if (events[i].time != prevTime) {
                // Only calculate rewards within the stake request period
                if (prevTime >= claimRequest.stakeTime) {
                    uint256 apr = _getAPR(currentAmount); // Get APR for the current stake amount
                    uint256 bonusPeriod = lockPeriods[claimRequest.lockPeriod]; // Get bonus APR for lock period

                    uint256 endCalculateTime = events[i].time;
                    if (events[i].time > unlockTime) {
                        endCalculateTime = unlockTime;
                    }

                    totalReward +=
                        (claimRequest.amount * (apr + bonusPeriod) * (endCalculateTime - prevTime)) /
                        100 /
                        365 /
                        ONE_DAY;
                    if (events[i].time > unlockTime) {
                        break;
                    }
                }
                prevTime = events[i].time; // Update the previous event time
            }

            // Update the active staked amount based on event type
            if (events[i].isStake) {
                currentAmount += events[i].amount; // Increase stake amount
            } else {
                currentAmount -= events[i].amount; // Decrease stake amount
            }
        }

        return totalReward;
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
     * @dev Uses and increments the nonce for the given owner.
     * @param owner The address of the owner.
     * @return The current nonce before incrementing.
     */
    function _useNonce(address owner) internal returns (uint256) {
        // For each account, the nonce has an initial value of 0, can only be incremented by one, and cannot be
        // decremented or reset. This guarantees that the nonce never overflows.
        unchecked {
            // It is important to do x++ and not ++x here.
            return nonces[owner]++;
        }
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
    function _hashStakeRequest(address user, uint256 amount, uint256 nonce) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(user, amount, nonce, block.timestamp));
    }

    function _paid(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            payable(to).sendValue(amount);
        } else {
            IERC20Upgradeable(token).safeTransfer(to, amount);
        }
    }
}
