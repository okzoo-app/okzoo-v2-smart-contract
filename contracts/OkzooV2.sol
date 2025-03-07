// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IOkzooV2Errors} from "./interfaces/errors/IOkzooV2Errors.sol";
import {IOkzooV2} from "./interfaces/IOkzooV2.sol";

import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

contract OkzooV2 is IOkzooV2, IOkzooV2Errors, EIP712Upgradeable {
    uint256 private constant SECONDS_IN_A_DAY = 86400; // 1 days TODO: Change to 86400
    // verifier address
    address public verifier;
    // User mapping
    mapping(address => User) public users;
    // Nonce mapping for EIP-712
    mapping(address account => uint256) public nonces;

    function initialize(
        address _verifier,
        string memory domainName,
        string memory signatureVersion
    ) public initializer {
        __EIP712_init(domainName, signatureVersion);
        verifier = _verifier;
    }

    modifier onlyUser() {
        if (users[msg.sender].lastCheckinDate == 0) {
            revert UserDoesNotExist();
        }
        _;
    }

    function _getDayofTimestamp(uint256 timestamp) private pure returns (uint256) {
        return timestamp / SECONDS_IN_A_DAY;
    }

    function checkIn() public {
        User storage user = users[msg.sender];
        uint256 currentDate = _getDayofTimestamp(block.timestamp);

        if (_getDayofTimestamp(user.lastCheckinDate) >= currentDate) {
            revert AlreadyCheckin();
        }

        // if user has pending bonus, must claim bonus before checkin
        if (user.pendingBonus) {
            revert MustClaimBonusBeforeCheckin();
        }

        // if user has never checked in before, set streak to 1 and stage to Protoform
        if (user.lastCheckinDate == 0) {
            user.streak = 1;
            user.stage = EvolutionStage.Protoform;
        } else {
            // if user has checked in before, check if it is consecutive day
            if (_getDayofTimestamp(user.lastCheckinDate) == currentDate - 1) {
                user.streak += 1;
            } else {
                // if user has missed a day, reset streak to 1
                user.streak = 1;
            }
        }

        // update last checkin date
        user.lastCheckinDate = block.timestamp;

        // if user has streak of 7, set pending bonus to true
        if (user.streak % 7 == 0 && !user.pendingBonus) {
            user.pendingBonus = true;
        }

        emit CheckIn(msg.sender, user.streak, block.timestamp);
    }

    function bonus() public onlyUser {
        User storage user = users[msg.sender];
        uint256 currentDate = _getDayofTimestamp(block.timestamp);

        if (user.lastCheckinDate == 0 || !user.pendingBonus) {
            revert NoBonusAvailable();
        }

        // if user has not checked in for more than 1 day, reset streak
        if (_getDayofTimestamp(user.lastCheckinDate) < currentDate - 1) {
            user.lastCheckinDate = block.timestamp;
            user.streak = 1;
        }

        user.pendingBonus = false; // reset pending bonus

        emit BonusClaimed(msg.sender, 1, block.timestamp);
    }

    function evolve(EvolutionStage _stage, uint256 _deadline, bytes memory _signature) public onlyUser {
        if (!verifyEvolve(msg.sender, _stage, _deadline, _useNonce(msg.sender), _signature)) revert InvalidSignature();

        if (_deadline < block.timestamp) revert DeadlinePassed();

        User storage user = users[msg.sender];

        if (user.stage == EvolutionStage.Prime) {
            revert AlreadyAtHighestStage();
        }

        user.stage = EvolutionStage(uint256(user.stage) + 1);

        emit Evolved(msg.sender, user.stage, block.timestamp);
    }

    function getStreak(address user) public view returns (uint256) {
        return users[user].streak;
    }

    function getLastCheckinDate(address user) public view returns (uint256) {
        return users[user].lastCheckinDate;
    }

    function getPendingBonus(address user) public view returns (bool) {
        return users[user].pendingBonus;
    }

    function _useNonce(address owner) internal returns (uint256) {
        // For each account, the nonce has an initial value of 0, can only be incremented by one, and cannot be
        // decremented or reset. This guarantees that the nonce never overflows.
        unchecked {
            // It is important to do x++ and not ++x here.
            return nonces[owner]++;
        }
    }

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
                    keccak256("EvolveRequest(address user,EvolutionStage stage,uint256 deadline,uint256 nonce)"),
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
