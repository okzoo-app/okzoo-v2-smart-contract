// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IOkzooSwap} from "./interfaces/IOkzooSwap.sol";
import {IOkzooSwapErrors} from "./interfaces/errors/IOkzooSwapErrors.sol";

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title OkzooSwap
 * @dev This contract facilitates secure off-chain token to ERC20 token swaps using off-chain EIP-712 signatures and delayed claims.
 *
 * Key Features:
 * - Signature-based authorization (via EIP-712) for swap and claim operations, verified by a trusted `verifier`.
 * - Time-lock mechanism: users initiate swaps and can only claim output tokens after a specified delay.
 * - Nonce and deadline checks to prevent replay attacks and ensure request freshness.
 * - Tracks individual swap requests by users using a unique identifier derived from swap parameters.
 * - Prevents double claiming and enforces strict ownership of swap requests.
 * - Owner privileges include withdrawing tokens/native ETH and updating the verifier address.
 *
 * Security:
 * - Implements OpenZeppelin’s upgradeable security modules: Ownable, ReentrancyGuard, Pausable, and SafeERC20.
 * - Swap and claim operations are protected against unauthorized access and reentrancy attacks.
 *
 * Intended Use:
 * - Supports token distribution, delayed rewards, and other trust-minimized token exchange workflows.
 */
contract OkzooSwap is
    IOkzooSwap,
    IOkzooSwapErrors,
    OwnableUpgradeable,
    EIP712Upgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address payable;

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    IERC20Upgradeable public swapToken; // ERC20 token used for swap

    // verifier address
    address public verifier;

    // User mapping
    mapping(address => User) public users;

    uint256 public totalClaimed; // Tracks user claimed amounts
    uint256 public swapPendingAmount; // Tracks pending swap amounts

    mapping(bytes32 => UserSwap) public userSwaps; // Maps swap requests by ID
    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private userSwapRequests; // Tracks swap request IDs for each user

    // Nonce mapping for EIP-712
    mapping(address => uint256) public nonces;

    /**
     * @dev Initializes the contract with a owner address, swap token, verifier address, domain name, and signature version.
     * @param _initialOwner The address of the initial owner.
     * @param _swapToken The address of the swap token.
     * @param _verifier The address of the verifier.
     * @param domainName The domain name for EIP-712.
     * @param signatureVersion The version of the signature.
     */
    function initialize(
        address _initialOwner,
        address _swapToken,
        address _verifier,
        string memory domainName,
        string memory signatureVersion
    ) public initializer {
        __Ownable_init();
        __EIP712_init(domainName, signatureVersion);
        __Pausable_init();
        __ReentrancyGuard_init();

        transferOwnership(_initialOwner);
        verifier = _verifier;
        swapToken = IERC20Upgradeable(_swapToken);
        if (verifier == address(0)) revert ZeroAddress();
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

    /**
     * @notice Creates a new token swap request with a specified lock time.
     * @param _inputAmount The amount of input tokens the user wants to swap.
     * @param _outputAmount The amount of output tokens the user expects to receive.
     * @param _swapLockTime The lock duration (in seconds) after which the user can claim the output tokens.
     * @param _deadline The timestamp by which this swap must be submitted. Used to prevent replay attacks.
     * @param _signature A signature verifying the swap request parameters, signed by an authorized signer.
     *
     * This function verifies the provided signature and deadline, then stores the swap request
     * in a mapping using a unique swap request ID. The swap will be claimable after the lock period ends.
     * Emits a `Swapped` event upon successful submission.
     */
    function swap(
        uint256 _inputAmount,
        uint256 _outputAmount,
        uint256 _swapLockTime,
        bytes32 _swapRequestId,
        uint256 _deadline,
        bytes memory _signature
    ) external nonReentrant whenNotPaused {
        // Verify the provided signature is valid for the swap request
        if (
            !verifySwap(
                msg.sender,
                _inputAmount,
                _outputAmount,
                _swapLockTime,
                _swapRequestId,
                _deadline,
                _useNonce(msg.sender),
                _signature
            )
        ) revert InvalidSignature();

        // Ensure the request hasn't expired
        if (_deadline < block.timestamp) revert DeadlinePassed();

        // Generate a unique identifier for this swap request using the hashed parameters and nonce
        // bytes32 _swapRequestId = _hashSwapRequest(msg.sender, _inputAmount, _outputAmount, _useNonce(msg.sender));

        // Calculate the time when the user can claim the output tokens (now + lock time)
        uint256 claimTime = block.timestamp + _swapLockTime;

        // Store the swap request in the mapping, marking it as not yet claimed
        userSwaps[_swapRequestId] = UserSwap({
            user: msg.sender,
            inputAmount: _inputAmount,
            outputAmount: _outputAmount,
            claimTime: claimTime,
            claimed: false
        });

        // Track this user's swap request ID
        userSwapRequests[msg.sender].add(_swapRequestId);

        // Track the user's total pending swaps
        swapPendingAmount += _outputAmount;

        // Emit an event to signal that a swap request has been successfully created
        emit Swapped(msg.sender, _inputAmount, _outputAmount, _swapRequestId, claimTime);
    }

    function claim(
        bytes32 _swapRequestId,
        uint256 _deadline,
        bytes memory _signature
    ) external nonReentrant whenNotPaused {
        // Verify the provided signature is valid for claiming the swap
        if (!verifyClaim(msg.sender, _swapRequestId, _deadline, _useNonce(msg.sender), _signature))
            revert InvalidSignature();

        // Ensure the claim request hasn't expired
        if (_deadline < block.timestamp) revert DeadlinePassed();

        // Retrieve the swap information from storage
        UserSwap storage userSwap = userSwaps[_swapRequestId];

        if (userSwap.user == address(0)) revert UserDoesNotExist();

        // Ensure the caller is the original swap initiator
        if (userSwap.user != msg.sender) revert InvalidUser();

        // Prevent double claiming
        if (userSwap.claimed) revert AlreadyClaimed();

        // Ensure the lock period has passed before allowing the claim
        if (userSwap.claimTime > block.timestamp) revert ClaimTimeNotReached();

        // Mark the swap as claimed
        userSwap.claimed = true;

        // Update global and user-specific claimed totals
        totalClaimed += userSwap.outputAmount;
        swapPendingAmount -= userSwap.outputAmount;
        users[msg.sender].totalClaimed += userSwap.outputAmount;

        // Transfer the output tokens to the user
        swapToken.safeTransfer(userSwap.user, userSwap.outputAmount);

        // Remove the swap request from the user's active request set
        userSwapRequests[userSwap.user].remove(_swapRequestId);

        // Emit event to signal the claim was successful
        emit Claimed(userSwap.user, _swapRequestId);
    }

    /**
     * @notice Allows the contract owner to withdraw tokens or native currency from the contract.
     * @dev If `token` is the zero address, the function sends native ETH. Otherwise, it transfers ERC20 tokens.
     * Emits a {Withdrawn} event on successful transfer.
     * @param token The address of the token to withdraw. Use address(0) for native ETH.
     * @param to The recipient address to receive the withdrawn funds.
     * @param amount The amount of tokens or ETH to withdraw.
     */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        _paid(token, to, amount);
        emit Withdrawn(token, to, amount);
    }

    /**
     * @dev Get available swap request
     * @param _user The user address
     */
    function getUserSwapRequests(address _user) public view returns (bytes32[] memory) {
        return userSwapRequests[_user].values();
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
     * @dev Verifies the swap request with the given signature.
     * @param _user The address of the user.
     * @param _deadline The deadline for the swap.
     * @param _nonce The nonce for the swap.
     * @param _signature The signature to validate the swap request.
     * @return True if the signature is valid, false otherwise.
     */
    function verifySwap(
        address _user,
        uint256 _inputAmount,
        uint256 _outputAmount,
        uint256 _swapLockTime,
        bytes32 _swapRequestId,
        uint256 _deadline,
        uint256 _nonce,
        bytes memory _signature
    ) public view returns (bool) {
        SwapRequest memory _swapRequest = SwapRequest({
            user: _user,
            inputAmount: _inputAmount,
            outputAmount: _outputAmount,
            swapLockTime: _swapLockTime,
            swapRequestId: _swapRequestId,
            deadline: _deadline,
            nonce: _nonce
        });

        address signer = _getSignerForSwapRequest(_swapRequest, _signature);
        return signer == verifier;
    }

    /**
     * @dev Verifies the claim request with the given signature.
     * @param _user The address of the user.
     * @param _deadline The deadline for the claim.
     * @param _nonce The nonce for the claim.
     * @param _signature The signature to validate the claim request.
     * @return True if the signature is valid, false otherwise.
     */
    function verifyClaim(
        address _user,
        bytes32 _swapRequestId,
        uint256 _deadline,
        uint256 _nonce,
        bytes memory _signature
    ) public view returns (bool) {
        ClaimRequest memory _claimRequest = ClaimRequest({
            user: _user,
            swapRequestId: _swapRequestId,
            deadline: _deadline,
            nonce: _nonce
        });

        address signer = _getSignerForClaimRequest(_claimRequest, _signature);
        return signer == verifier;
    }

    /**
     * @dev Verify the swap request with signature
     * @param _swapRequest An swap request
     * @param _signature The signature to validate the swap request
     */
    function _getSignerForSwapRequest(
        SwapRequest memory _swapRequest,
        bytes memory _signature
    ) internal view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "SwapRequest(address user,uint256 inputAmount,uint256 outputAmount,uint256 swapLockTime,bytes32 swapRequestId,uint256 deadline,uint256 nonce)"
                    ),
                    _swapRequest.user,
                    _swapRequest.inputAmount,
                    _swapRequest.outputAmount,
                    _swapRequest.swapLockTime,
                    _swapRequest.swapRequestId,
                    _swapRequest.deadline,
                    _swapRequest.nonce
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, _signature);
    }

    /**
     * @dev Verify the claim request with signature
     * @param _claimRequest An claim request
     * @param _signature The signature to validate the claim request
     */
    function _getSignerForClaimRequest(
        ClaimRequest memory _claimRequest,
        bytes memory _signature
    ) internal view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ClaimRequest(address user,bytes32 swapRequestId,uint256 deadline,uint256 nonce)"),
                    _claimRequest.user,
                    _claimRequest.swapRequestId,
                    _claimRequest.deadline,
                    _claimRequest.nonce
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, _signature);
    }

    /**
     * @dev Generates a unique hash for a swap request.
     *
     * This function creates a unique identifier for a swap request by hashing the user's address,
     * the swap inputAmount, the swap outputAmount and the current block timestamp. The hash can be used to uniquely identify
     * a swapping action, ensuring that each swap request is distinct.
     *
     * @param user The address of the user initiating the swap.
     * @param inputAmount The amount of tokens being swapped.
     * @param outputAmount The amount of tokens being received.
     *
     * @return bytes32 A unique hash representing the swap request.
     */
    function _hashSwapRequest(
        address user,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(user, inputAmount, outputAmount, nonce, block.timestamp));
    }

    /**
     * @dev Transfers tokens or native ETH to the specified address.
     * If the `token` address is zero, sends native ETH using `sendValue`.
     * Otherwise, safely transfers ERC20 tokens using `safeTransfer`.
     * @param token The address of the token to transfer. Use address(0) for native ETH.
     * @param to The recipient address to receive the funds.
     * @param amount The amount of tokens or ETH to send.
     */
    function _paid(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            payable(to).sendValue(amount);
        } else {
            IERC20Upgradeable(token).safeTransfer(to, amount);
        }
    }
}
