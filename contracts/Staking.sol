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

    uint256 public constant MAXIMUM_UNLOCK_REQUESTS = 5;

    IERC20Upgradeable public stakeToken;
    uint256 public unstakeLockTime;
    uint256 public totalStaked;

    mapping(address => uint256) public stakedAmount;
    mapping(bytes32 => UnstakeRequest) public unstakeRequests;
    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private userUnstakeRequests;
    // Use for emergency withdraw
    bool public isEmergencyWithdraw;

    function initialize(address _stakeToken, uint256 _unstakeLockTime, address _owner) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        if (_stakeToken == address(0)) {
            revert ZeroAddress();
        }
        stakeToken = IERC20Upgradeable(_stakeToken);
        unstakeLockTime = _unstakeLockTime;

        transferOwnership(_owner);
    }

    /**************************|
    |          Getters         |
    |_________________________*/

    /**
     * @dev Get available unstake request
     * @param _user The user address
     */
    function getUserUnstakeRequests(address _user) public view returns (bytes32[] memory) {
        return userUnstakeRequests[_user].values();
    }

    /**************************|
    |          Setters         |
    |_________________________*/

    /**
     * @dev Set the unstake lock time
     * @param _unstakeLockTime The new start time
     */
    function setUnstakeLockTime(uint256 _unstakeLockTime) external onlyOwner {
        emit UnstakeLockTimeChanged(unstakeLockTime, _unstakeLockTime);
        unstakeLockTime = _unstakeLockTime;
    }

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
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) {
            revert InvalidAmount();
        }

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        stakedAmount[msg.sender] += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @dev Unstakes tokens
     * @param amount The amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused returns (bytes32 unstakeRequestId) {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (stakedAmount[msg.sender] < amount) {
            revert InsufficientStakedAmount();
        }

        if (userUnstakeRequests[msg.sender].length() >= MAXIMUM_UNLOCK_REQUESTS) {
            revert MaximumUnstakeRequestReached();
        }

        stakedAmount[msg.sender] -= amount;
        totalStaked -= amount;

        unstakeRequestId = _hashUnstakeRequest(msg.sender, amount);
        if (unstakeRequests[unstakeRequestId].amount != 0) {
            revert DuplicateUnstakeRequest();
        }

        uint256 claimTime = block.timestamp + unstakeLockTime;

        unstakeRequests[unstakeRequestId] = UnstakeRequest({
            owner: msg.sender,
            amount: amount,
            claimTime: claimTime,
            claimed: false
        });

        userUnstakeRequests[msg.sender].add(unstakeRequestId);

        emit Unstake(msg.sender, unstakeRequestId, amount, claimTime);
    }

    /**
     * @dev Claim multiple unstaked requests
     * @param unstakeRequestIds The unstake request ids
     */
    function claimMultiple(bytes32[] calldata unstakeRequestIds) external nonReentrant whenNotPaused {
        for (uint256 i; i < unstakeRequestIds.length; i++) {
            _claim(unstakeRequestIds[i]);
        }
    }

    /**
     * @dev Claim unstaked request
     * @notice Claim can only be called after the unstaking period has ended
     * @param unstakeRequestId The unstake request id
     */
    function claim(bytes32 unstakeRequestId) external nonReentrant whenNotPaused {
        _claim(unstakeRequestId);
    }

    function _claim(bytes32 unstakeRequestId) internal {
        UnstakeRequest memory unstakeRequest = unstakeRequests[unstakeRequestId];

        if (unstakeRequest.owner != msg.sender) {
            revert NotRequestOwner();
        }

        if (block.timestamp < unstakeRequest.claimTime) {
            revert NotClaimTime();
        }

        if (unstakeRequest.claimed) {
            revert AlreadyClaimed();
        }

        unstakeRequests[unstakeRequestId].claimed = true;
        userUnstakeRequests[msg.sender].remove(unstakeRequestId);

        stakeToken.safeTransfer(msg.sender, unstakeRequest.amount);

        emit Claimed(msg.sender, unstakeRequestId, unstakeRequest.amount);
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

        bytes32[] memory unstakeRequestIds = getUserUnstakeRequests(msg.sender);
        // Withdraw all unstake requests
        for (uint256 i; i < unstakeRequestIds.length; i++) {
            bytes32 unstakeRequestId = unstakeRequestIds[i];

            claimAmount += unstakeRequests[unstakeRequestId].amount;
            unstakeRequests[unstakeRequestId].claimed = true;

            userUnstakeRequests[msg.sender].remove(unstakeRequestId);
        }

        if (claimAmount == 0) {
            revert InsufficientStakedAmount();
        }

        stakeToken.safeTransfer(msg.sender, claimAmount);

        emit EmergencyWithdrawn(msg.sender, claimAmount);
    }

    function _hashUnstakeRequest(address user, uint256 amount) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(user, amount, block.timestamp));
    }
}
