import { ethers } from "hardhat";
import { expect } from "chai";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { SellSoulboundNFT, SoulboundNFT, ERC20 } from "../typechain-types";

describe("SellSoulboundNFT", function () {
    let contract: SellSoulboundNFT;
    let contractAddress: string;
    let nft: SoulboundNFT;
    let paymentToken1: ERC20;
    let paymentToken2: ERC20;
    let paymentToken1Address: string;
    let paymentToken2Address: string;

    let owner: any, user1: any, user2: any;

    let whitelistAddresses: string[];
    let merkleTree: StandardMerkleTree<string[]>;
    let merkleRoot: string;

    beforeEach(async () => {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy mock payment token
        const ERC20Mock = await ethers.getContractFactory("OkzooToken");

        paymentToken1 = await ERC20Mock.deploy("USDT1", "USDT1", ethers.parseEther("1000"), owner.address);
        paymentToken2 = await ERC20Mock.deploy("USDT2", "USDT2", ethers.parseEther("1000"), owner.address);

        // Deploy Soulbound NFT
        const NFT = await ethers.getContractFactory("SoulboundNFT");
        nft = await NFT.deploy("Soulbound", "SBT", [owner.address], owner.address);

        const nftAddress = await nft.getAddress();
        paymentToken1Address = await paymentToken1.getAddress();
        paymentToken2Address = await paymentToken2.getAddress();

        // Deploy SellSoulboundNFT
        const Sell = await ethers.getContractFactory("SellSoulboundNFT");
        contract = await Sell.deploy();
        await contract.initialize(nftAddress, owner.address);

        contractAddress = await contract.getAddress();

        // Grant mint role to contract
        await nft.connect(owner).addMinter(contractAddress);

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
            maxMint: 3,
        });

        await contract.connect(owner).setPublicConfig({
            startTime: Math.floor(Date.now() / 1000) - 100,
            endTime: Math.floor(Date.now() / 1000) + 3600,
        });

        await contract.connect(owner).setPaymentToken(paymentToken1Address, ethers.parseEther("10"));
        await contract.connect(owner).setPaymentToken(paymentToken2Address, ethers.parseEther("15"));

        // await paymentToken1.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
        // await paymentToken2.connect(owner).transfer(user2.address, ethers.parseEther("1000"));

        // // Approve tokens
        // await paymentToken1.connect(user1).approve(contractAddress, ethers.parseEther("1000"));
        // await paymentToken2.connect(user2).approve(contractAddress, ethers.parseEther("1000"));
    });

    async function fundAndApprove(user: any, token: any, amount: any) {
        await token.connect(owner).transfer(user.address, amount);
        await token.connect(user).approve(contractAddress, amount);
    }

    describe("Whitelist mint", () => {
        it("should allow whitelist mint", async () => {
            const proof = merkleTree.getProof(0);
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            const mint = await contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proof, true);
            await expect(mint).to.emit(contract, "NFTSold");
        });
        it("should mint successfully with valid proof", async () => {
            const proof = merkleTree.getProof(0);
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await expect(
                contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proof, true),
            ).to.emit(contract, "NFTSold");
        });

        it("should fail with invalid proof", async () => {
            const wrongProof = merkleTree.getProof(0);
            await fundAndApprove(user2, paymentToken1, ethers.parseEther("10"));
            await expect(
                contract.connect(user2).buy(paymentToken1Address, ethers.parseEther("10"), wrongProof, true),
            ).to.be.revertedWithCustomError(contract, "InvalidProof");
        });

        it("should fail if already minted", async () => {
            const proof = merkleTree.getProof(0);
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proof, true);
            await expect(contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proof, true)).to.be
                .reverted;
        });
    });

    describe("Public mint", () => {
        it("should allow public mint", async () => {
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            const mint = await contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), [], false);
            await expect(mint).to.emit(contract, "NFTSold");
        });
    });

    describe("Payment tokens", () => {
        it("should fail with unsupported token", async () => {
            const randomTokenAddress = "0x0000000000000000000000000000000000000000";
            await expect(
                contract.connect(user1).buy(randomTokenAddress, ethers.parseEther("10"), [], false),
            ).to.be.revertedWithCustomError(contract, "InvalidPaymentToken");
        });
    });

    describe("Buy with multiple payment tokens", () => {
        let proofUser1: string[];

        beforeEach(async () => {
            proofUser1 = merkleTree.getProof(0);

            // Fund user1 with both tokens
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("20"));
            await fundAndApprove(user1, paymentToken2, ethers.parseEther("20"));
        });

        it("should allow buy with first token (USDT1)", async () => {
            const prevBal = await paymentToken1.balanceOf(user1.address);
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proofUser1, true);

            const afterBal = await paymentToken1.balanceOf(user1.address);
            expect(afterBal - prevBal).to.equal(ethers.parseEther("0"));
        });

        it("should allow buy with second token (USDT2)", async () => {
            const prevBal = await paymentToken2.balanceOf(user1.address);
            await fundAndApprove(user1, paymentToken2, ethers.parseEther("15"));
            await contract.connect(user1).buy(paymentToken2Address, ethers.parseEther("15"), proofUser1, true);

            const afterBal = await paymentToken2.balanceOf(user1.address);
            expect(afterBal - prevBal).to.equal(ethers.parseEther("0"));
        });

        it("should allow multiple buys with different tokens", async () => {
            const prevBal1 = await paymentToken1.balanceOf(user1.address);
            const prevBal2 = await paymentToken2.balanceOf(user2.address);

            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await fundAndApprove(user2, paymentToken2, ethers.parseEther("15"));

            await contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), [], false);
            await contract.connect(user2).buy(paymentToken2Address, ethers.parseEther("15"), [], false);

            const afterBal1 = await paymentToken1.balanceOf(user1.address);
            const afterBal2 = await paymentToken2.balanceOf(user2.address);

            expect(afterBal1 - prevBal1).to.equal(ethers.parseEther("0"));
            expect(afterBal2 - prevBal2).to.equal(ethers.parseEther("0"));
        });

        it("should revert if payment token is not supported", async () => {
            const ERC20Mock = await ethers.getContractFactory("OkzooToken");
            const fakeToken = await ERC20Mock.deploy("FAKE", "FAKE", ethers.parseEther("1000"), owner.address);
            const fakeTokenAddress = await fakeToken.getAddress();
            await fakeToken.connect(owner).transfer(user1.address, ethers.parseEther("10"));
            await fakeToken.connect(user1).approve(contractAddress, ethers.parseEther("10"));

            await expect(
                contract.connect(user1).buy(fakeTokenAddress, ethers.parseEther("10"), [], false),
            ).to.be.revertedWithCustomError(contract, "InvalidPaymentToken");
        });
    });

    describe("Pause", () => {
        it("should pause and unpause correctly", async () => {
            await contract.connect(owner).pause();
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await expect(contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), [], false)).to.be
                .reverted;

            await contract.connect(owner).unpause();
            await expect(contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), [], false)).to.emit(
                contract,
                "NFTSold",
            );
        });

        it("should block mint when paused", async () => {
            await contract.connect(owner).pause();
            const proof = merkleTree.getProof(0);
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await expect(
                contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proof, true),
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    it("should reject invalid proof", async () => {
        const proof = merkleTree.getProof(0);
        await expect(
            contract.connect(user2).buy(paymentToken1Address, ethers.parseEther("10"), proof, true),
        ).to.be.revertedWithCustomError(contract, "InvalidProof");
    });

    describe("Withdraw", () => {
        it("should withdraw tokens", async () => {
            const proof = merkleTree.getProof(0);
            await fundAndApprove(user1, paymentToken1, ethers.parseEther("10"));
            await contract.connect(user1).buy(paymentToken1Address, ethers.parseEther("10"), proof, true);

            const prevBal = await paymentToken1.balanceOf(owner.address);
            await contract.connect(owner).withdraw(paymentToken1Address, owner.address, ethers.parseEther("10"));
            const afterBal = await paymentToken1.balanceOf(owner.address);
            expect(afterBal - prevBal).to.equal(ethers.parseEther("10"));
        });
    });

    const buildTree = (addresses: string[]): StandardMerkleTree<string[]> => {
        const data = addresses.map((address) => [address]);

        const tree = StandardMerkleTree.of(data, ["address"]);

        tree.validate();

        return tree;
    };
});
