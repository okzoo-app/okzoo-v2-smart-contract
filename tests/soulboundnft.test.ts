import { ethers } from "hardhat";
import { expect } from "chai";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { SellSoulboundNFT, SoulboundNFT, ERC20 } from "../typechain-types";

describe("SellSoulboundNFT", function () {
    let contract: SellSoulboundNFT;
    let contractAddress: string;
    let nft: SoulboundNFT;
    let paymentToken: ERC20;

    let owner: any, user1: any, user2: any;

    let whitelistAddresses: string[];
    let merkleTree: StandardMerkleTree<string[]>;
    let merkleRoot: string;

    beforeEach(async () => {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy mock payment token
        const ERC20Mock = await ethers.getContractFactory("OkzooToken");

        paymentToken = await ERC20Mock.deploy("USDT", "USDT", ethers.parseEther("1000"), owner.address);

        // Deploy Soulbound NFT
        const NFT = await ethers.getContractFactory("SoulboundNFT");
        nft = await NFT.deploy("Soulbound", "SBT", owner.address, owner.address);

        const nftAddress = await nft.getAddress();
        const paymentTokenAddress = await paymentToken.getAddress();

        // Deploy SellSoulboundNFT
        const Sell = await ethers.getContractFactory("SellSoulboundNFT");
        contract = await Sell.deploy();
        await contract.initialize(nftAddress, owner.address, paymentTokenAddress);

        contractAddress = await contract.getAddress();

        // Grant mint role to contract
        await nft.connect(owner).setMinter(contractAddress);

        // Create batch
        await contract.connect(owner).createBatch(1, 10, "ipfs://baseURI");

        // Setup whitelist
        whitelistAddresses = [user1.address, owner.address];
        merkleTree = buildTree(whitelistAddresses);
        merkleRoot = merkleTree.root;

        await contract.connect(owner).setWhitelistConfig({
            whitelistMerkleRoot: merkleRoot,
            startTime: Math.floor(Date.now() / 1000) - 100,
            endTime: Math.floor(Date.now() / 1000) + 3600,
            price: ethers.parseEther("10"),
            maxMint: 3,
        });

        await contract.connect(owner).setPublicConfig({
            startTime: Math.floor(Date.now() / 1000) - 100,
            endTime: Math.floor(Date.now() / 1000) + 3600,
            price: ethers.parseEther("15"),
        });

        await paymentToken.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

        // Approve tokens
        await paymentToken.connect(user1).approve(contractAddress, ethers.parseEther("1000"));
    });

    it("should allow whitelist mint", async () => {
        const proof = merkleTree.getProof(0);
        const mint = await contract.connect(user1).buyWithWhitelist(proof, ethers.parseEther("10"));
        await expect(mint).to.emit(contract, "NFTSold");
    });

    it("should reject invalid proof", async () => {
        const proof = merkleTree.getProof(0);
        await expect(
            contract.connect(user2).buyWithWhitelist(proof, ethers.parseEther("10")),
        ).to.be.revertedWithCustomError(contract, "InvalidProof");
    });

    it("should allow public mint", async () => {
        await expect(contract.connect(user1).buyPublic(ethers.parseEther("15"))).to.emit(contract, "NFTSold");
    });

    it("should pause and unpause correctly", async () => {
        await contract.connect(owner).pause();
        await expect(contract.connect(user1).buyPublic(ethers.parseEther("15"))).to.be.reverted;

        await contract.connect(owner).unpause();
        await expect(contract.connect(user1).buyPublic(ethers.parseEther("15"))).to.emit(contract, "NFTSold");
    });

    it("should allow withdraw", async () => {
        await contract.connect(owner).withdraw(owner.address, 0); // No fund yet

        const proof = merkleTree.getProof(0);
        await contract.connect(user1).buyWithWhitelist(proof, ethers.parseEther("10"));

        const prevBal = await paymentToken.balanceOf(owner.address);
        await contract.connect(owner).withdraw(owner.address, ethers.parseEther("10"));
        const afterBal = await paymentToken.balanceOf(owner.address);
        expect(afterBal - prevBal).to.equal(ethers.parseEther("10"));
    });

    const buildTree = (addresses: string[]): StandardMerkleTree<string[]> => {
        const data = addresses.map((address) => [address]);

        const tree = StandardMerkleTree.of(data, ["address"]);

        tree.validate();

        return tree;
    };
});
