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

    SoulboundNFT public nft;

    IERC20Upgradeable public paymentToken;

    bytes32 public whitelistMerkleRoot;

    WhitelistConfig public whitelistConfig;

    PublicConfig public publicConfig;

    // Batch info

    uint256 public currentBatchId;
    uint256 public totalMinted;
    mapping(uint256 => Batch) public batches;

    function initialize(address _nft, address _initialOwner, bytes32 _whitelistMerkleRoot) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        _transferOwnership(_initialOwner);
        nft = SoulboundNFT(_nft);
        whitelistMerkleRoot = _whitelistMerkleRoot;
    }

    // --- Batch config ---
    function createBatch(uint256 startId, uint256 endId, string calldata baseURI) external onlyOwner {
        require(endId > startId, ISellSoulboundNFTErrors.InvalidRange());
        currentBatchId++;
        batches[currentBatchId] = Batch(startId, endId, baseURI, 0);
    }

    /// @notice Buy NFT with whitelist proof
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

        _buy(to, true);
    }

    function buyPublic(address to, uint256 paymentAmount) external nonReentrant whenNotPaused {
        require(
            block.timestamp >= publicConfig.startTime && block.timestamp <= publicConfig.endTime,
            ISellSoulboundNFTErrors.InvalidPublicConfig()
        );
        require(paymentAmount >= publicConfig.price, ISellSoulboundNFTErrors.InsufficientPayment());
        _buy(to, false);
    }

    /// @notice Buy NFT (minted with custom URI)
    function _buy(address to, bool isWhitelist) internal {
        Batch storage batch = batches[currentBatchId];
        uint256 newTokenId = batch.startId + batch.minted;

        require(newTokenId <= batch.endId, ISellSoulboundNFTErrors.InvalidBatch());
        if (isWhitelist) {
            require(batch.minted < whitelistConfig.maxMint, ISellSoulboundNFTErrors.InvalidMinted());
        }

        string memory uri = string(abi.encodePacked(batch.baseURI, "/", Strings.toString(newTokenId), ".json"));

        // Mint NFT to buyer
        uint256 tokenId = nft.safeMint(to, uri);

        batch.minted++;
        totalMinted++;
        emit NFTSold(to, tokenId);
    }

    /// @notice Withdraw ETH (just in case funds stuck)
    function withdraw(address to, uint256 amount) external onlyOwner {
        address _paymentToken = address(paymentToken);
        if (_paymentToken == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20Upgradeable(_paymentToken).safeTransfer(to, amount);
        }
        emit Withdraw(to, amount);
    }

    function verifyWhitelistProof(address account, bytes32[] calldata proof) public view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account))));
        return MerkleProofUpgradeable.verifyCalldata(proof, whitelistMerkleRoot, leaf);
    }
}
