// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

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

    // Payment token
    IERC20Upgradeable public paymentToken;

    // Whitelist config
    WhitelistConfig public whitelistConfig;

    // Public config
    PublicConfig public publicConfig;

    // Current batch id
    uint256 public currentBatchId;

    // Batches
    mapping(uint256 => Batch) public batches;

    // Total minted
    uint256 public totalMinted;

    /**
     * @dev Initializes the contract.
     * @param _nft The address of the SoulboundNFT contract.
     * @param _initialOwner The address of the initial owner.
     * @param _paymentToken The address of the payment token.
     */
    function initialize(address _nft, address _initialOwner, address _paymentToken) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        _transferOwnership(_initialOwner);
        nft = SoulboundNFT(_nft);
        paymentToken = IERC20Upgradeable(_paymentToken);
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
    }

    /**
     * @notice Sets the public config.
     * @dev Only owner can set the public config.
     * @param _publicConfig The public config.
     */
    function setPublicConfig(PublicConfig calldata _publicConfig) external onlyOwner {
        publicConfig = _publicConfig;
    }

    /**
     * @notice Creates a new batch.
     * @dev Only owner can create a new batch.
     * @param startId The start token ID of the batch.
     * @param endId The end token ID of the batch.
     * @param baseURI The base URI of the batch.
     */
    function createBatch(uint256 startId, uint256 endId, string calldata baseURI) external onlyOwner {
        require(endId > startId, ISellSoulboundNFTErrors.InvalidRange());

        currentBatchId++;
        batches[currentBatchId] = Batch(startId, endId, baseURI, 0);
    }

    /**
     * @notice Buy NFT with whitelist proof
     * @dev Only owner can create a new batch.
     * @param to The address of the buyer.
     * @param proof The proof of the whitelist.
     * @param paymentAmount The amount of payment.
     */
    function buyWithWhitelist(
        address to,
        bytes32[] calldata proof,
        uint256 paymentAmount
    ) external nonReentrant whenNotPaused {
        require(verifyWhitelistProof(msg.sender, proof), ISellSoulboundNFTErrors.InvalidProof());
        require(
            block.timestamp >= whitelistConfig.startTime && block.timestamp <= whitelistConfig.endTime,
            ISellSoulboundNFTErrors.InvalidWhitelistConfig()
        );
        require(paymentAmount >= whitelistConfig.price, ISellSoulboundNFTErrors.InsufficientPayment());

        _buy(to, paymentAmount, true);
    }

    /**
     * @notice Buy NFT with public proof
     * @dev Only owner can create a new batch.
     * @param to The address of the buyer.
     * @param paymentAmount The amount of payment.
     */
    function buyPublic(address to, uint256 paymentAmount) external nonReentrant whenNotPaused {
        require(
            block.timestamp >= publicConfig.startTime && block.timestamp <= publicConfig.endTime,
            ISellSoulboundNFTErrors.InvalidPublicConfig()
        );
        require(paymentAmount >= publicConfig.price, ISellSoulboundNFTErrors.InsufficientPayment());
        _buy(to, paymentAmount, false);
    }

    /**
     * @notice Buy NFT (minted with custom URI)
     * @dev Only owner can create a new batch.
     * @param to The address of the buyer.
     * @param paymentAmount The amount of payment.
     * @param isWhitelist Whether the buyer is in the whitelist.
     */
    function _buy(address to, uint256 paymentAmount, bool isWhitelist) internal {
        Batch storage batch = batches[currentBatchId];
        uint256 newTokenId = batch.startId + batch.minted;

        require(newTokenId <= batch.endId, ISellSoulboundNFTErrors.InvalidBatch());
        if (isWhitelist) {
            require(batch.minted < whitelistConfig.maxMint, ISellSoulboundNFTErrors.InvalidMinted());
        }

        // Transfer payment token from buyer to contract
        paymentToken.safeTransferFrom(msg.sender, address(this), paymentAmount);

        // Generate URI for the NFT
        string memory uri = string(abi.encodePacked(batch.baseURI, "/", Strings.toString(newTokenId), ".json"));

        // Mint NFT to buyer
        uint256 tokenId = nft.safeMint(to, uri);

        // Update batch minted and total minted
        batch.minted++;
        totalMinted++;
        emit NFTSold(to, tokenId);
    }

    /**
     * @notice Withdraw ETH (just in case funds stuck)
     * @dev Only owner can withdraw the funds.
     * @param to The address of the receiver.
     * @param amount The amount of funds to withdraw.
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        address _paymentToken = address(paymentToken);
        if (_paymentToken == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20Upgradeable(_paymentToken).safeTransfer(to, amount);
        }
        emit Withdraw(to, amount);
    }

    /**
     * @notice Verifies the whitelist proof.
     * @dev Only owner can verify the whitelist proof.
     * @param account The address of the account.
     * @param proof The proof of the whitelist.
     */
    function verifyWhitelistProof(address account, bytes32[] calldata proof) public view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account))));
        return MerkleProofUpgradeable.verifyCalldata(proof, whitelistConfig.whitelistMerkleRoot, leaf);
    }
}
