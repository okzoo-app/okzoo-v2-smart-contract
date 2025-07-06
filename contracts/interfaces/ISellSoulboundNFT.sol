// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISellSoulboundNFT {
    struct WhitelistConfig {
        uint256 startTime;
        uint256 endTime;
        uint256 price;
        uint256 maxMint;
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

    event NFTSold(address indexed buyer, uint256 indexed tokenId);
    event Withdraw(address indexed to, uint256 amount);

    function buyWithWhitelist(address to, bytes32[] calldata proof, uint256 paymentAmount) external;
    function buyPublic(address to, uint256 paymentAmount) external;
    function withdraw(address to, uint256 amount) external;
}
