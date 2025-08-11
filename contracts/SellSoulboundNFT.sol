// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SoulboundNFT} from "./SoulboundNFT.sol";
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ISellSoulboundNFT} from "./interfaces/ISellSoulboundNFT.sol";
import {ISellSoulboundNFTErrors} from "./interfaces/errors/ISellSoulboundNFTErrors.sol";

/**
 * @title SellSoulboundNFT
 * @dev A contract to facilitate the sale of Soulbound NFTs (non-transferable tokens)
 *      with support for whitelist and public sale phases.
 *
 *      Features:
 *      - Uses Merkle Tree based whitelist verification for presale access.
 *      - Supports batch minting with configurable token ID ranges and metadata base URI.
 *      - Handles payments using a specified ERC20 token or native ETH (if paymentToken is address(0)).
 *      - Includes pausability, ownership, access control, and reentrancy protection.
 *      - Allows withdrawal of collected payments by the contract owner.
 *      - Automatically unpauses after 12 hours if paused and no manual unpause.
 *
 * @notice This contract requires an external SoulboundNFT contract that implements safeMint.
 *         Tokens minted are soulbound (non-transferable) NFTs.
 *
 * @custom:security
 * - Uses OpenZeppelin upgradeable modules for security and upgradeability.
 * - Protects payment transfers with SafeERC20.
 * - Ensures only owner can configure batches, whitelist, and public sale parameters.
 */
contract SellSoulboundNFT is
    ISellSoulboundNFT,
    ISellSoulboundNFTErrors,
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Paused at timestamp
    uint256 public pausedAt;

    // SoulboundNFT contract
    SoulboundNFT public nft;

    // Payment token price
    mapping(address => uint256) public paymentTokenPrice;

    // Whitelist config
    WhitelistConfig public whitelistConfig;

    // Public config
    PublicConfig public publicConfig;

    // Current batch id
    uint256 public currentBatchId;

    // Batches
    mapping(uint256 => Batch) public batches;
    // Store lastEnd and check
    uint256 public lastBatchEnd;

    // Whitelist minted
    uint256 public whitelistMinted;
    // Total minted
    uint256 public totalMinted;

    // Is User Minted
    mapping(address => Minted) public minted;

    /**
     * @dev Initializes the contract.
     * @param _nft The address of the SoulboundNFT contract.
     * @param _initialOwner The address of the initial owner.
     */
    function initialize(address _nft, address _initialOwner) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        _transferOwnership(_initialOwner);

        require(_nft != address(0), ISellSoulboundNFTErrors.ZeroAddress());
        nft = SoulboundNFT(_nft);
    }

    /**
     * @notice Sets the payment token price.
     * @dev Only owner can set the payment token price.
     * @param token The address of the payment token.
     * @param price The price of the payment token.
     */
    function setPaymentToken(address token, uint256 price) external onlyOwner {
        require(price > 0, "Price must be > 0");
        paymentTokenPrice[token] = price;
        emit PaymentTokenSet(token, price);
    }

    /**
     * @notice Removes the payment token price.
     * @dev Only owner can remove the payment token price.
     * @param token The address of the payment token.
     */
    function removePaymentToken(address token) external onlyOwner {
        delete paymentTokenPrice[token];
        emit PaymentTokenSet(token, 0);
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

    /**
     * @notice Sets the whitelist config.
     * @dev Only owner can set the whitelist config.
     * @param _whitelistConfig The whitelist config.
     */
    function setWhitelistConfig(WhitelistConfig calldata _whitelistConfig) external onlyOwner {
        whitelistConfig = _whitelistConfig;
        emit WhitelistConfigSet(
            _whitelistConfig.startTime,
            _whitelistConfig.endTime,
            _whitelistConfig.maxMint,
            _whitelistConfig.whitelistMerkleRoot
        );
    }

    /**
     * @notice Sets the public config.
     * @dev Only owner can set the public config.
     * @param _publicConfig The public config.
     */
    function setPublicConfig(PublicConfig calldata _publicConfig) external onlyOwner {
        publicConfig = _publicConfig;
        emit PublicConfigSet(_publicConfig.startTime, _publicConfig.endTime);
    }

    /**
     * @notice Creates a new batch.
     * @dev Only owner can create a new batch.
     * @param startId The start token ID of the batch.
     * @param endId The end token ID of the batch.
     * @param baseURI The base URI of the batch.
     */
    function createBatch(uint256 startId, uint256 endId, string calldata baseURI) external onlyOwner {
        require(endId >= startId, ISellSoulboundNFTErrors.InvalidRange());
        require(startId > lastBatchEnd, ISellSoulboundNFTErrors.InvalidBatch());

        currentBatchId++;
        batches[currentBatchId] = Batch(startId, endId, baseURI, 0);
        lastBatchEnd = endId;

        emit BatchCreated(currentBatchId, startId, endId, baseURI);
    }

    /**
     * @notice Buys an NFT.
     * @dev User can buy an NFT.
     * @param token The address of the payment token.
     * @param proof The proof of the whitelist.
     * @param isWhitelist Whether the user is in the whitelist.
     */
    function buy(
        address token,
        bytes32[] calldata proof, // whitelist proof
        bool isWhitelist
    ) external payable nonReentrant autoUnpause whenNotPaused {
        uint256 price = paymentTokenPrice[token];
        require(price > 0, ISellSoulboundNFTErrors.InvalidPaymentToken());

        // If whitelist, verify whitelist proof and check whitelist config
        if (isWhitelist) {
            require(verifyWhitelistProof(msg.sender, proof), ISellSoulboundNFTErrors.InvalidProof());
            require(
                block.timestamp >= whitelistConfig.startTime && block.timestamp <= whitelistConfig.endTime,
                ISellSoulboundNFTErrors.InvalidWhitelistConfig()
            );
        } else {
            // If public, check public config
            require(
                block.timestamp >= publicConfig.startTime && block.timestamp <= publicConfig.endTime,
                ISellSoulboundNFTErrors.InvalidPublicConfig()
            );
        }

        // Payment
        if (token == address(0)) {
            // ETH payment
            require(msg.value >= price, ISellSoulboundNFTErrors.InsufficientPayment());
        } else {
            // ERC20 payment
            IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), price);
        }

        // Mint NFT
        _mintNFT(msg.sender, isWhitelist, token, price);
    }

    /**
     * @dev Mints an NFT.
     * @param to The address of the user.
     * @param isWhitelist Whether the user is in the whitelist.
     * @param token The address of the payment token.
     * @param price The price of the payment token.
     */
    function _mintNFT(address to, bool isWhitelist, address token, uint256 price) internal {
        Batch storage batch = batches[currentBatchId];
        uint256 newTokenId = batch.startId + batch.minted;
        require(newTokenId <= batch.endId, ISellSoulboundNFTErrors.InvalidBatch());

        if (isWhitelist) {
            require(whitelistMinted < whitelistConfig.maxMint, ISellSoulboundNFTErrors.InvalidMinted());
            whitelistMinted++;
        }

        string memory uri = string(abi.encodePacked(batch.baseURI, "/", Strings.toString(newTokenId), ".json"));
        uint256 tokenId = nft.safeMint(to, uri);

        minted[to] = Minted(currentBatchId, tokenId, to, token, price, block.timestamp);
        batch.minted++;
        totalMinted++;

        emit NFTSold(to, tokenId, currentBatchId, token, price, isWhitelist, block.timestamp);
    }

    /**
     * @notice Withdraw ETH (just in case funds stuck)
     * @dev Only owner can withdraw the funds.
     * @param to The address of the receiver.
     * @param amount The amount of funds to withdraw.
     */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20Upgradeable(token).safeTransfer(to, amount);
        }
        emit Withdraw(token, to, amount);
    }

    /**
     * @notice Verifies the whitelist proof.
     * @param account The address of the account.
     * @param proof The proof of the whitelist.
     */
    function verifyWhitelistProof(address account, bytes32[] calldata proof) public view returns (bool) {
        // bytes32 leaf = keccak256(abi.encodePacked(account));
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account))));

        return MerkleProofUpgradeable.verifyCalldata(proof, whitelistConfig.whitelistMerkleRoot, leaf);
    }
}
