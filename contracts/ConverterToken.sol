// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {SoulboundNFT} from "./SoulboundNFT.sol";
import {IConverterToken} from "./interfaces/IConverterToken.sol";
import {IConverterTokenErrors} from "./interfaces/errors/IConverterToken.sol";

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

    IERC20Upgradeable public token;
    SoulboundNFT public nft;

    address public verifier;

    uint256 public pausedAt;

    uint256 public totalConvertedInAmount;
    uint256 public totalConvertedOutAmount;
    mapping(address => Conversion[]) public conversionHistory;

    function initialize(
        address _initialOwner,
        address _verifier,
        address _token,
        address _nft,
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
    }

    modifier onlySBHolder() {
        require(nft.balanceOf(msg.sender) > 0, IConverterTokenErrors.NotNftHolder());
        _;
    }

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
     * @dev Automatically unpauses the contract after 12 hours if it was paused.
     */
    modifier autoUnpause() {
        if (paused() && block.timestamp >= pausedAt + 12 hours) {
            _unpause();
        }
        _;
    }

    function convert(
        uint256 amountIn,
        uint256 amountOut,
        uint256 deadline,
        uint256 nonce,
        bytes memory signature
    ) external onlySBHolder autoUnpause nonReentrant whenNotPaused {
        require(amountIn > 0, IConverterTokenErrors.InvalidAmount());
        require(amountOut > 0, IConverterTokenErrors.InvalidAmount());

        require(
            verifyConvertRequest(msg.sender, amountIn, amountOut, deadline, nonce, signature),
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

        emit Converted(msg.sender, amountIn, amountOut, block.timestamp);
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
        uint256 _deadline,
        uint256 _nonce,
        bytes memory _signature
    ) public view returns (bool) {
        ConvertRequest memory _convertRequest = ConvertRequest({
            user: _user,
            amountIn: _amountIn,
            amountOut: _amountOut,
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
                        "ConvertRequest(address user,uint256 amountIn,uint256 amountOut,uint256 deadline,uint256 nonce)"
                    ),
                    _convertRequest.user,
                    _convertRequest.amountIn,
                    _convertRequest.amountOut,
                    _convertRequest.deadline,
                    _convertRequest.nonce
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, _signature);
    }
}
