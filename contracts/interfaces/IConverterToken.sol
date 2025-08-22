// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IConverterToken {
    struct ConvertRequest {
        address user;
        uint256 amountIn;
        uint256 amountOut;
        uint256 convertId;
        uint256 deadline;
        uint256 nonce;
    }

    struct Conversion {
        uint256 amountIn;
        uint256 amountOut;
        uint256 timestamp;
    }

    event Converted(address indexed user, uint256 amountIn, uint256 amountOut, uint256 convertId, uint256 timestamp);
    event Withdraw(address indexed token, address indexed to, uint256 amount);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event MaxConvertOutAmountUpdated(uint256 oldMaxConvertOutAmount, uint256 newMaxConvertOutAmount);
    event ConvertCooldownUpdated(uint256 oldConvertCooldown, uint256 newConvertCooldown);

    function initialize(
        address _initialOwner,
        address _verifier,
        address _token,
        address _nft,
        uint256 _convertCooldown,
        uint256 _maxConvertOutAmount,
        string memory _domainName,
        string memory _signatureVersion
    ) external;

    function withdraw(address _token, address to, uint256 amount) external;

    function updateVerifier(address newVerifier) external;

    function updateConvertCooldown(uint256 newConvertCooldown) external;

    function updateMaxConvertOutAmount(uint256 newMaxConvertOutAmount) external;

    function convert(
        uint256 amountIn,
        uint256 amountOut,
        uint256 convertId,
        uint256 deadline,
        bytes memory signature
    ) external;

    function nonces(address owner) external view returns (uint256);

    function getUserConvertHistory(address user) external view returns (Conversion[] memory);
}
