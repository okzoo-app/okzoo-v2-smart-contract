// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IOkzooV2Errors} from "./interfaces/errors/IOkzooV2Errors.sol";
import {IOkzooV2} from "./interfaces/IOkzooV2.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title OkzooV2
 * @dev This contract manages user check-ins, streak-milestone-reached, and evolution stages using EIP-712 signatures for verification.
 */
contract OkzooV2 is IOkzooV2, IOkzooV2Errors, OwnableUpgradeable, EIP712Upgradeable {
    uint256 private constant ONE_DAY = 1 days; // 1 days
    // verifier address
    address public verifier;
    // User mapping
    mapping(address => User) public users;
    // Nonce mapping for EIP-712
    mapping(address => uint256) public nonces;

    /**
     * @dev Initializes the contract with a owner address, verifier address, domain name, and signature version.
     * @param initialOwner The address of the initial owner.
     * @param _verifier The address of the verifier.
     * @param domainName The domain name for EIP-712.
     * @param signatureVersion The version of the signature.
     */
    function initialize(
        address initialOwner,
        address _verifier,
        string memory domainName,
        string memory signatureVersion
    ) public initializer {
        __Ownable_init();
        __EIP712_init(domainName, signatureVersion);
        transferOwnership(initialOwner);
        verifier = _verifier;
    }

    /**
     * @dev Set verifier address
     * @param _verifier The address of the new verifier.
     */
    function setVerifier(address _verifier) external onlyOwner {
        if (_verifier == address(0)) revert ZeroAddress();
        verifier = _verifier;
        emit VerifierChanged(_verifier);
    }

    /**
     * @dev Returns the day of the given timestamp.
     * @param timestamp The timestamp to convert.
     * @return The day of the timestamp.
     */
    function _getDayofTimestamp(uint256 timestamp) private pure returns (uint256) {
        return timestamp / ONE_DAY;
    }

    /**
     * @dev Allows a user to check in, updating their streak and stage if applicable.
     *      User must claim the bonnus before checkin
     * @param _deadline The deadline for the check-in. A request send after the deadline will throw an error.
     * @param _signature The signature for verification.
     */
    function checkIn(uint256 _deadline, bytes memory _signature) public {
        if (!verifyCheckIn(msg.sender, _deadline, _useNonce(msg.sender), _signature)) revert InvalidSignature();

        if (_deadline < block.timestamp) revert DeadlinePassed();

        User storage user = users[msg.sender];
        uint256 currentDate = _getDayofTimestamp(block.timestamp);

        if (_getDayofTimestamp(user.lastCheckinDate) >= currentDate) {
            revert AlreadyCheckin();
        }

        unchecked {
            // if user has never checked in before, set streak to 1 and stage to Protoform
            if (user.lastCheckinDate == 0) {
                user.streak = 1;
            } else {
                // if user has checked in before, check if it is consecutive day
                if (_getDayofTimestamp(user.lastCheckinDate) == currentDate - 1) {
                    user.streak += 1;
                } else {
                    // if user has missed a day, reset streak to 1
                    user.streak = 1;
                    user.pendingBonus = false; // reset pending bonus
                }
            }
        }

        // update last checkin date
        user.lastCheckinDate = block.timestamp;

        // if user has streak of 7, set pending bonus to true
        if (user.streak % 7 == 0 && !user.pendingBonus) {
            user.pendingBonus = true;
        }

        emit CheckedIn(msg.sender, user.streak, block.timestamp);
    }

    /**
     * @notice Called when a user wants to claim a streak milestone bonus.
     * @dev This function checks if the user is eligible for the milestone reward
     * based on their current check-in streak (e.g., every 7 days).
     * Requirements:
     * - Valid signature must be provided.
     * - Deadline must not have passed.
     * - User must have an ongoing streak and be due a pending bonus.
     * - Streak must be a multiple of 7 (milestone).
     *
     * @param _deadline Timestamp by which the request must be processed.
     * @param _signature Signed message proving the user's intent.
     */

    function streakMilestone(uint256 _deadline, bytes memory _signature) public {
        if (!verifyCheckIn(msg.sender, _deadline, _useNonce(msg.sender), _signature)) revert InvalidSignature();

        if (_deadline < block.timestamp) revert DeadlinePassed();

        User storage user = users[msg.sender];

        uint256 currentStreak = getStreak(msg.sender);

        if (user.lastCheckinDate == 0 || user.pendingBonus == false || currentStreak == 0 || currentStreak % 7 != 0) {
            revert StreakMilestoneNotReached();
        }

        user.pendingBonus = false; // reset pending bonus

        emit StreakMilestoneReached(msg.sender, user.lastCheckinDate, 1, block.timestamp);
    }

    /**
     * @dev Allows a user to evolve to the next stage if applicable.
     * @param _stage The stage to evolve to.
     * @param _deadline The deadline for the evolution.
     * @param _signature The signature for verification.
     */
    function evolve(EvolutionStage _stage, uint256 _deadline, bytes memory _signature) public {
        if (!verifyEvolve(msg.sender, _stage, _deadline, _useNonce(msg.sender), _signature)) revert InvalidSignature();

        if (_deadline < block.timestamp) revert DeadlinePassed();

        User storage user = users[msg.sender];

        if (user.stage == EvolutionStage.Prime) {
            revert AlreadyAtHighestStage();
        }

        EvolutionStage nextStage = EvolutionStage(uint256(user.stage) + 1);

        if (user.stage == _stage || nextStage != _stage) {
            revert AlreadyEvolved();
        }

        // just evolve to the next stage
        user.stage = nextStage;

        emit Evolved(msg.sender, user.stage, block.timestamp);
    }

    /**
     * @dev Returns the current streak of the user.
     * @param user The address of the user.
     * @return The current streak of the user.
     */
    function getStreak(address user) public view returns (uint256) {
        uint256 currentDate = _getDayofTimestamp(block.timestamp);
        uint256 lastCheckinDate = _getDayofTimestamp(users[user].lastCheckinDate);
        if (lastCheckinDate < currentDate - 1) {
            return 0;
        }
        return users[user].streak;
    }

    /**
     * @dev Returns the last check-in date of the user.
     * @param user The address of the user.
     * @return The last check-in date of the user.
     */
    function getLastCheckinDate(address user) public view returns (uint256) {
        return users[user].lastCheckinDate;
    }

    /**
     * @dev Returns whether the user has a pending bonus.
     * @param user The address of the user.
     * @return True if the user has a pending bonus, false otherwise.
     */
    function getPendingBonus(address user) public view returns (bool) {
        return users[user].pendingBonus;
    }

    /**
     * @dev Returns the current stage of the user.
     * @param user The address of the user.
     * @return The current stage of the user.
     */
    function getStage(address user) public view returns (EvolutionStage) {
        return users[user].stage;
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
     * @dev Verifies the check-in request with the given signature.
     * @param _user The address of the user.
     * @param _deadline The deadline for the check-in.
     * @param _nonce The nonce for the check-in.
     * @param _signature The signature to validate the check-in request.
     * @return True if the signature is valid, false otherwise.
     */
    function verifyCheckIn(
        address _user,
        uint256 _deadline,
        uint256 _nonce,
        bytes memory _signature
    ) public view returns (bool) {
        CheckInRequest memory _checkinRequest = CheckInRequest({user: _user, deadline: _deadline, nonce: _nonce});

        address signer = _getSignerForCheckInRequest(_checkinRequest, _signature);
        return signer == verifier;
    }

    /**
     * @dev Verifies the evolve request with the given signature.
     * @param _user The address of the user.
     * @param _stage The stage to evolve to.
     * @param _deadline The deadline for the evolution.
     * @param _nonce The nonce for the evolution.
     * @param _signature The signature to validate the evolve request.
     * @return True if the signature is valid, false otherwise.
     */
    function verifyEvolve(
        address _user,
        EvolutionStage _stage,
        uint256 _deadline,
        uint256 _nonce,
        bytes memory _signature
    ) public view returns (bool) {
        EvolveRequest memory _evolveRequest = EvolveRequest({
            user: _user,
            stage: _stage,
            deadline: _deadline,
            nonce: _nonce
        });

        address signer = _getSignerForEvolveRequest(_evolveRequest, _signature);
        return signer == verifier;
    }

    /**
     * @dev Verify the checkin request with signature
     *
     * @param _checkinRequest An checkin request
     * @param _signature The signature to validate the checkin request
     */
    function _getSignerForCheckInRequest(
        CheckInRequest memory _checkinRequest,
        bytes memory _signature
    ) internal view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("CheckInRequest(address user,uint256 deadline,uint256 nonce)"),
                    _checkinRequest.user,
                    _checkinRequest.deadline,
                    _checkinRequest.nonce
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, _signature);
    }

    /**
     * @dev Verify the evolve request with signature
     *
     * @param _evolveRequest An evolve request
     * @param _signature The signature to validate the evolve request
     */
    function _getSignerForEvolveRequest(
        EvolveRequest memory _evolveRequest,
        bytes memory _signature
    ) internal view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("EvolveRequest(address user,uint8 stage,uint256 deadline,uint256 nonce)"),
                    _evolveRequest.user,
                    _evolveRequest.stage,
                    _evolveRequest.deadline,
                    _evolveRequest.nonce
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, _signature);
    }
}
