// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISellSoulboundNFTErrors {
    error ZeroAddress();
    error InvalidRange();
    error InvalidAmount();
    error InsufficientPayment();
    error InvalidProof();
    error InvalidWhitelistConfig();
    error InvalidPublicConfig();
    error InvalidTotalSupply();
    error InvalidMinted();
    error InvalidPayment();
    error InvalidPaymentToken();
}
