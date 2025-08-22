// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Import OpenZeppelin upgradeable utilities
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

// Custom imports
import {SoulboundNFT} from "./SoulboundNFT.sol";
import {IConverterToken} from "./interfaces/IConverterToken.sol";
import {IConverterTokenErrors} from "./interfaces/errors/IConverterToken.sol";

/**
 * @title ConverterToken
 * @notice Allows SB NFT holders to convert alpha tokens into real tokens via off-chain signed authorization.
 * @dev Uses EIP-712 for secure off-chain signature verification.
 */
contract ConverterToken is
    IConverterToken,
    IConverterTokenErrors,
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    EIP712Upgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using ECDSAUpgradeable for bytes32;

    // ====== State Variables ======
    IERC20Upgradeable public token; // Token to send out (converted result)
    SoulboundNFT public nft; // Required NFT for access

    address public verifier; // Off-chain signer verifying convert requests

    uint256 public pausedAt; // Timestamp when contract was paused

    uint256 public totalConvertedInAmount; // Total alpha tokens converted in
    uint256 public totalConvertedOutAmount; // Total actual tokens sent out
    uint256 public maxConvertOutAmount; // Max actual tokens sent out per user

    mapping(address => Conversion[]) public conversionHistory; // Per-user history
    mapping(address => uint256) public totalConvertedInAmountPerUser; // Total alpha tokens converted in per user
    mapping(address => uint256) public totalConvertedOutAmountPerUser; // Total actual tokens sent out per user
    mapping(address => uint256) public nonces; // Per-user nonces for replay protection

    mapping(address => uint256) public lastConvertAt; // Last conversion timestamp for each user
    uint256 public convertCooldown; // Cooldown period for each user in seconds

    // ====== Initializer ======

    /**
     * @notice Initializes the contract with configuration parameters.
     * @param _initialOwner The address to receive contract ownership.
     * @param _verifier The off-chain address that signs convert requests.
     * @param _token The ERC20 token address for output.
     * @param _nft The soulbound NFT required to convert.
     * @param _convertCooldown The cooldown period for each user in seconds.
     * @param _domainName EIP-712 domain name.
     * @param _signatureVersion EIP-712 version string.
     */

    function initialize(
        address _initialOwner,
        address _verifier,
        address _token,
        address _nft,
        uint256 _convertCooldown,
        uint256 _maxConvertOutAmount,
        string memory _domainName,
        string memory _signatureVersion
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        __EIP712_init(_domainName, _signatureVersion);
        _transferOwnership(_initialOwner);
        token = IERC20Upgradeable(_token);
        nft = SoulboundNFT(_nft);
        verifier = _verifier;
        convertCooldown = _convertCooldown;
        maxConvertOutAmount = _maxConvertOutAmount;
        emit ConvertCooldownUpdated(0, _convertCooldown);
        emit MaxConvertOutAmountUpdated(0, _maxConvertOutAmount);
    }

    // ====== Modifiers ======

    /**
     * @notice Modifier to check if the caller is an SB NFT holder.
     */
    modifier onlySBHolder() {
        require(nft.balanceOf(msg.sender) > 0, IConverterTokenErrors.NotNftHolder());
        _;
    }

    /**
     * @dev Automatically unpauses the contract after 12 hours if it was paused.
     */
    modifier autoUnpause() {
        if (paused() && block.timestamp >= pausedAt + 12 hours) {
            _unpause();
        }
        _;
    }

    // ====== Admin Functions ======

    /**
     * @notice Pauses the contract.
     * @dev Only owner can pause the contract.
     */
    function pause() external onlyOwner {
        pausedAt = block.timestamp;
        _pause();
    }

    /**
     * @notice Unpauses the contract.
     * @dev Only owner can unpause the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw ETH (just in case funds stuck)
     * @dev Only owner can withdraw the funds.
     * @param _token The address of the token to withdraw.
     * @param to The address of the receiver.
     * @param amount The amount of funds to withdraw.
     */
    function withdraw(address _token, address to, uint256 amount) external onlyOwner {
        if (_token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20Upgradeable(_token).safeTransfer(to, amount);
        }
        emit Withdraw(_token, to, amount);
    }

    /**
     * @notice Updates the verifier address.
     * @dev Only owner can update the verifier address.
     * @param newVerifier The new verifier address.
     */
    function updateVerifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), IConverterTokenErrors.InvalidVerifier());
        verifier = newVerifier;
        emit VerifierUpdated(verifier, newVerifier);
    }

    /**
     * @notice Updates the convert cooldown.
     * @dev Only owner can update the convert cooldown.
     * @param newConvertCooldown The new convert cooldown.
     */
    function updateConvertCooldown(uint256 newConvertCooldown) external onlyOwner {
        require(newConvertCooldown > 0, IConverterTokenErrors.InvalidAmount());
        convertCooldown = newConvertCooldown;
        emit ConvertCooldownUpdated(convertCooldown, newConvertCooldown);
    }

    /**
     * @notice Updates the max converted out amount.
     * @dev Only owner can update the max converted out amount.
     * @param newMaxConvertOutAmount The new max converted out amount.
     */
    function updateMaxConvertOutAmount(uint256 newMaxConvertOutAmount) external onlyOwner {
        require(newMaxConvertOutAmount > 0, IConverterTokenErrors.InvalidAmount());
        maxConvertOutAmount = newMaxConvertOutAmount;
        emit MaxConvertOutAmountUpdated(maxConvertOutAmount, newMaxConvertOutAmount);
    }

    // ====== Main Logic ======

    /**
     * @notice Performs a token conversion based on a valid off-chain signature.
     * @param amountIn Alpha tokens being "burned" (off-chain).
     * @param amountOut Tokens to receive.
     * @param deadline Expiry timestamp of the signed request.
     * @param signature EIP-712 signature from trusted verifier.
     */
    function convert(
        uint256 amountIn,
        uint256 amountOut,
        uint256 convertId,
        uint256 deadline,
        bytes memory signature
    ) external onlySBHolder autoUnpause nonReentrant whenNotPaused {
        require(
            block.timestamp >= lastConvertAt[msg.sender] + convertCooldown,
            IConverterTokenErrors.CooldownNotOver()
        );
        require(amountIn > 0, IConverterTokenErrors.InvalidAmount());
        require(amountOut > 0, IConverterTokenErrors.InvalidAmount());
        require(totalConvertedOutAmountPerUser[msg.sender] + amountOut <= maxConvertOutAmount, IConverterTokenErrors.MaxConvertOutAmountExceeded());

        require(
            verifyConvertRequest(
                msg.sender,
                amountIn,
                amountOut,
                convertId,
                deadline,
                _useNonce(msg.sender),
                signature
            ),
            IConverterTokenErrors.InvalidSignature()
        );

        require(deadline > block.timestamp, IConverterTokenErrors.DeadlinePassed());

        require(token.balanceOf(address(this)) >= amountOut, IConverterTokenErrors.InsufficientBalance());

        token.safeTransfer(msg.sender, amountOut);

        // Update state
        conversionHistory[msg.sender].push(
            Conversion({amountIn: amountIn, amountOut: amountOut, timestamp: block.timestamp})
        );

        totalConvertedInAmount += amountIn;
        totalConvertedOutAmount += amountOut;
        totalConvertedInAmountPerUser[msg.sender] += amountIn;
        totalConvertedOutAmountPerUser[msg.sender] += amountOut;
        lastConvertAt[msg.sender] = block.timestamp;

        emit Converted(msg.sender, amountIn, amountOut, convertId, block.timestamp);
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

    // ====== View Functions ======

    /**
     * @notice Returns the conversion history for a user.
     * @param user The address of the user.
     * @return history The array of Conversion structs for the user.
     */
    function getUserConvertHistory(address user) external view returns (Conversion[] memory history) {
        return conversionHistory[user];
    }

    /**
     * @dev Verifies the convert request with the given signature.
     * @param _user The address of the user.
     * @param _amountIn The amount of tokens to convert.
     * @param _amountOut The amount of tokens to receive.
     * @param _deadline The deadline for the conversion.
     * @param _nonce The nonce for the conversion.
     * @param _signature The signature to validate the convert request.
     * @return True if the signature is valid, false otherwise.
     */
    function verifyConvertRequest(
        address _user,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _convertId,
        uint256 _deadline,
        uint256 _nonce,
        bytes memory _signature
    ) public view returns (bool) {
        ConvertRequest memory _convertRequest = ConvertRequest({
            user: _user,
            amountIn: _amountIn,
            amountOut: _amountOut,
            convertId: _convertId,
            deadline: _deadline,
            nonce: _nonce
        });

        address signer = _getSignerForConvertRequest(_convertRequest, _signature);
        return signer == verifier;
    }

    /**
     * @dev Verify the convert request with signature
     *
     * @param _convertRequest An convert request
     * @param _signature The signature to validate the convert request
     */
    function _getSignerForConvertRequest(
        ConvertRequest memory _convertRequest,
        bytes memory _signature
    ) internal view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "ConvertRequest(address user,uint256 amountIn,uint256 amountOut,uint256 convertId,uint256 deadline,uint256 nonce)"
                    ),
                    _convertRequest.user,
                    _convertRequest.amountIn,
                    _convertRequest.amountOut,
                    _convertRequest.convertId,
                    _convertRequest.deadline,
                    _convertRequest.nonce
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, _signature);
    }
}
