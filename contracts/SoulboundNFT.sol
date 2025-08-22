// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface ISoulboundNFTErrors {
    error InvalidAddress();
    error AlreadyMinter();
    error AlreadyMinted();
    error NotMinter();
    error NotMinted();
    error TokenIsNonTransferable();
    error ApprovalNotAllowed();
}

contract SoulboundNFT is ISoulboundNFTErrors, ERC721, ERC721Enumerable, ERC721Burnable, Ownable {
    uint256 private _nextTokenId = 1;
    mapping(address => bool) public minters;
    mapping(address => bool) public hasMinted;

    string public baseURI;

    // --- Events ---
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event BaseURIUpdated(string newBaseURI);

    constructor(
        string memory name,
        string memory symbol,
        address[] memory _minters,
        address initialOwner,
        string memory _baseURI
    ) ERC721(name, symbol) Ownable(initialOwner) {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);

        for (uint256 i = 0; i < _minters.length; i++) {
            minters[_minters[i]] = true;
            emit MinterAdded(_minters[i]);
        }
    }

    modifier onlyMinter() {
        require(minters[msg.sender], ISoulboundNFTErrors.NotMinter());
        _;
    }

    // --- BaseURI Management ---
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }

    // --- Minter Management ---
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), ISoulboundNFTErrors.InvalidAddress());
        require(!minters[_minter], ISoulboundNFTErrors.AlreadyMinter());

        minters[_minter] = true;
        emit MinterAdded(_minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], ISoulboundNFTErrors.NotMinter());

        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    function safeMint(address to) public onlyMinter returns (uint256) {
        require(to != address(0), ISoulboundNFTErrors.InvalidAddress());
        require(!hasMinted[to], ISoulboundNFTErrors.AlreadyMinted());

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        // string memory uri = string(abi.encodePacked(baseURI, "/", Strings.toString(tokenId), ".json"));
        // _setTokenURI(tokenId, uri);

        hasMinted[to] = true;
        return tokenId;
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0), ISoulboundNFTErrors.TokenIsNonTransferable());
        require(to != address(0), ISoulboundNFTErrors.InvalidAddress());
        require(minters[msg.sender], ISoulboundNFTErrors.NotMinter());
        require(hasMinted[to], ISoulboundNFTErrors.NotMinted());
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(baseURI, "/", Strings.toString(tokenId), ".json"));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // --- Soulbound enforcement ---
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert ISoulboundNFTErrors.ApprovalNotAllowed();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert ISoulboundNFTErrors.ApprovalNotAllowed();
    }
}
