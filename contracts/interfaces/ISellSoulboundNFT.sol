// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISellSoulboundNFT {
    struct WhitelistConfig {
        uint256 startTime;
        uint256 endTime;
        uint256 price;
        uint256 maxMint;
        bytes32 whitelistMerkleRoot;
    }

    struct PublicConfig {
        uint256 startTime;
        uint256 endTime;
        uint256 price;
    }

    struct Batch {
        uint256 startId;
        uint256 endId;
        string baseURI;
        uint256 minted;
    }

    struct Minted {
        uint256 batchId;
        uint256 tokenId;
        address buyer;
        uint256 paymentAmount;
        uint256 timestamp;
    }

    event WhitelistConfigSet(WhitelistConfig config);
    event PublicConfigSet(PublicConfig config);
    event BatchCreated(uint256 indexed batchId, uint256 startId, uint256 endId, string baseURI);
    event NFTSold(address indexed buyer, uint256 indexed tokenId, uint256 indexed batchId);
    event Withdraw(address indexed to, uint256 amount);

    function buyWithWhitelist(bytes32[] calldata proof, uint256 paymentAmount) external;
    function buyPublic(uint256 paymentAmount) external;
    function withdraw(address to, uint256 amount) external;
}
