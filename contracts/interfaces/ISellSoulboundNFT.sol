// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISellSoulboundNFT {
    struct WhitelistConfig {
        uint256 startTime;
        uint256 endTime;
        uint256 maxMint;
        bytes32 whitelistMerkleRoot;
    }

    struct PublicConfig {
        uint256 startTime;
        uint256 endTime;
    }

    struct Batch {
        uint256 totalSupply;
        uint256 minted;
    }

    struct Minted {
        uint256 batchId;
        uint256 tokenId;
        address buyer;
        address token;
        uint256 price;
        uint256 timestamp;
    }

    event PaymentTokenSet(address indexed token, uint256 price);

    event WhitelistConfigSet(uint256 startTime, uint256 endTime, uint256 maxMint, bytes32 whitelistMerkleRoot);
    event PublicConfigSet(uint256 startTime, uint256 endTime);
    event Withdraw(address indexed token, address indexed to, uint256 amount);
    event BatchCreated(uint256 indexed batchId, uint256 totalSupply);
    event NFTSold(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 indexed batchId,
        address token,
        uint256 price,
        bool isWhitelist,
        uint256 timestamp
    );

    function initialize(address _nft, address _initialOwner) external;
    function setPaymentToken(address token, uint256 price) external;
    function removePaymentToken(address token) external;
    function setWhitelistConfig(WhitelistConfig calldata config) external;
    function setPublicConfig(PublicConfig calldata config) external;
    function createBatch(uint256 totalSupply) external;
    function buy(address token, uint256 paymentAmount, bytes32[] calldata proof, bool isWhitelist) external payable;
    function withdraw(address token, address to, uint256 amount) external;
}
