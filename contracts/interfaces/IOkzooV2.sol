// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOkzooV2 {
    struct User {
        uint256 streak; // streak of user
        uint256 lastCheckinDate; //  last checkin date
        bool pendingBonus; // check if user has pending bonus
        EvolutionStage stage; // evolution stage of user
    }

    struct EvolveRequest {
        address user;
        EvolutionStage stage;
        uint256 deadline;
        uint256 nonce;
    }

    enum EvolutionStage {
        Protoform,
        Infantile,
        Juvenile,
        Adolescent,
        Prime
    }

    event CheckIn(address indexed user, uint256 streak, uint256 timestamp);
    event BonusClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event Evolved(address indexed user, EvolutionStage newStage, uint256 timestamp);

    function checkIn() external;

    function bonus() external;

    function evolve(EvolutionStage _stage, uint256 _deadline, bytes memory _signature) external;

    function nonces(address owner) external view returns (uint256);

    function getStreak(address user) external view returns (uint256);

    function getLastCheckinDate(address user) external view returns (uint256);

    function getPendingBonus(address user) external view returns (bool);
}
