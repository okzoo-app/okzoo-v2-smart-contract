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

contract Staking is IStaking, IStakingErrors, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    uint256 private constant ONE_DAY = 1 days;

    struct Event {
        uint256 time;
        uint256 amount;
        bool isStart;
    }

    uint256 public constant MAXIMUM_STAKE_REQUESTS = 5;
    uint256 public maxCap;
    uint256 public minStakeAmount;

    IERC20Upgradeable public stakeToken;
    IERC20Upgradeable public rewardToken;
    uint256 public totalStaked;

    mapping(uint256 => Tier) public tiers;
    mapping(uint256 => uint256) public lockPeriods;

    mapping(address => uint256) public stakedAmount;
    mapping(bytes32 => StakeRequest) public stakeRequests;
    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private userStakeRequests;
    mapping(address => Event[]) private userStakeEvents;
    // Use for emergency withdraw
    bool public isEmergencyWithdraw;

    // bytes32[] calldata unstakeRequestIds
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
            if (_tiers[i].baseAPR == 0) {
                revert InvalidBaseAPR();
            }
            tiers[i] = _tiers[i];
        }
        for (uint256 i = 0; i < _lockPeriods.length; i++) {
            lockPeriods[_lockPeriods[i].daysLocked] = _lockPeriods[i].aprBonus;
        }
    }
    function getTier(uint256 amount) public view returns (uint256) {
        uint256 i = 0;
        while (true) {
            if (tiers[i].maxStake == 0) {
                break;
            }
            if (amount >= tiers[i].minStake && amount < tiers[i].maxStake) {
                return i;
            }
            i++;
        }
        revert InvalidAmount();
    }

    function getAPR(uint256 amount) external view returns (uint256) {
        uint256 tierIndex = getTier(amount);
        return tiers[tierIndex].baseAPR;
    }

    function getPeriodBonus(uint256 daysLocked) external view returns (uint256) {
        return lockPeriods[daysLocked];
    }

    /**************************|
    |          Getters         |
    |_________________________*/

    /**
     * @dev Get available stake request
     * @param _user The user address
     */
    function getUserStakeRequests(address _user) public view returns (bytes32[] memory) {
        return userStakeRequests[_user].values();
    }

    /**************************|
    |         Pausable         |
    |_________________________*/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**************************|
    |          Staking         |
    |_________________________*/

    /**
     * @dev Stake tokens
     * @param amount The amount to stake
     */
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant whenNotPaused {
        if (amount < minStakeAmount || totalStaked + amount > maxCap) {
            revert InvalidAmount();
        }

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        bytes32 stakeRequestId = _hashStakeRequest(msg.sender, amount);

        StakeRequest memory stakeRq = StakeRequest({
            owner: msg.sender,
            amount: amount,
            lockPeriod: lockPeriod,
            stakeTime: block.timestamp,
            unLockTime: block.timestamp + lockPeriod * ONE_DAY,
            claimed: false
        });

        stakeRequests[stakeRequestId] = stakeRq;

        userStakeRequests[msg.sender].add(stakeRequestId);

        userStakeEvents[msg.sender].push(Event(stakeRq.stakeTime, stakeRq.amount, true));
        userStakeEvents[msg.sender].push(Event(stakeRq.unLockTime, stakeRq.amount, false));

        stakedAmount[msg.sender] += amount;
        totalStaked += amount;

        emit Staked(msg.sender, stakeRequestId, amount, lockPeriod);
    }

    /**
     * @dev Claim staked request
    //  * @notice Claim can only be called after the unstaking period has ended
     * @param stakeRequestId The stake request id
     */
    function claim(bytes32 stakeRequestId) external nonReentrant whenNotPaused {
        StakeRequest memory stakeRequest = stakeRequests[stakeRequestId]; // current stake request

        if (stakeRequest.owner != msg.sender) {
            revert NotRequestOwner();
        }

        if (stakeRequest.claimed) {
            revert AlreadyClaimed();
        }

        uint256 reward = _calculateReward(stakeRequest);

        emit Claimed(msg.sender, stakeRequestId, stakeRequest.amount, reward);
    }

    function _hashStakeRequest(address user, uint256 amount) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(user, amount, block.timestamp));
    }

    function _calculateReward(StakeRequest memory claimRequest) internal view returns (uint256 totalReward) {
        Event[] memory events = userStakeEvents[claimRequest.owner];

        for (uint256 i = 0; i < events.length; i++) {
            for (uint256 j = i + 1; j < events.length; j++) {
                if (events[i].time > events[j].time || (events[i].time == events[j].time && !events[i].isStart)) {
                    Event memory temp = events[i];
                    events[i] = events[j];
                    events[j] = temp;
                }
            }
        }

        uint256 currentAmount = 0;
        uint256 prevTime = events[0].time;

        for (uint256 i = 0; i < events.length; i++) {
            if (events[i].time != prevTime) {
                if (prevTime >= claimRequest.stakeTime && events[i].time <= claimRequest.unLockTime) {
                    uint256 apr = this.getAPR(currentAmount);
                    uint256 bonusPeriod = lockPeriods[claimRequest.lockPeriod];
                    totalReward +=
                        (currentAmount * (apr + bonusPeriod) * (events[i].time - prevTime)) /
                        100 /
                        365 /
                        ONE_DAY;
                }
                prevTime = events[i].time;
            }

            if (events[i].isStart) {
                currentAmount += events[i].amount;
            } else {
                currentAmount -= events[i].amount;
            }
        }

        return totalReward;
    }
}
