// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract SoulboundNFT is ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Burnable, Ownable {
    uint256 private _nextTokenId = 1;
    mapping(address => bool) public minters;
    mapping(address => bool) public hasMinted;

    // --- Events ---
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor(
        string memory name,
        string memory symbol,
        address[] memory _minters,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {
        for (uint256 i = 0; i < _minters.length; i++) {
            minters[_minters[i]] = true;
            emit MinterAdded(_minters[i]);
        }
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Soulbound: not a minter");
        _;
    }

    // --- Minter Management ---
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid address");
        require(!minters[_minter], "Already a minter");

        minters[_minter] = true;
        emit MinterAdded(_minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], "Not a minter");

        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    function safeMint(address to, string memory uri) public onlyMinter returns (uint256) {
        require(to != address(0), "Soulbound: to is zero address");
        require(!hasMinted[to], "Soulbound: already minted");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        hasMinted[to] = true;
        return tokenId;
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        require(_ownerOf(tokenId) == address(0), "Soulbound: token is non-transferable");
        require(to != address(0), "Soulbound: to is zero address");
        require(minters[msg.sender], "Soulbound: only minter can mint");
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // --- Soulbound enforcement ---
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert("Soulbound: approval not allowed");
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert("Soulbound: approval not allowed");
    }
}
