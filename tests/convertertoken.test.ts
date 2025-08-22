import { ethers, network } from "hardhat";
import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ConverterToken", function () {
    let converter: any;
    let converterAddress: string;
    let token: any;
    let nft: any;
    let owner: any, verifier: any, user: any, other: any;
    let domain: any;

    const DOMAIN_NAME = "Converter";
    const DOMAIN_VERSION = "1.0";

    beforeEach(async () => {
        [owner, verifier, user, other] = await ethers.getSigners();

        // Deploy mock token
        const MockToken = await ethers.getContractFactory("OkzooToken");
        token = await MockToken.deploy("AIOT", "AIOT", ethers.parseEther("1000"), owner.address);

        // Deploy mock soulbound NFT
        const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
        nft = await SoulboundNFT.deploy("Soulbound", "SBT", owner.address, owner.address);

        // Mint NFT to user
        await nft.connect(owner).safeMint(user.address, "ipfs://baseURI");

        // Deploy main contract
        const Converter = await ethers.getContractFactory("ConverterToken");
        converter = await Converter.deploy();
        await converter.initialize(
            owner.address,
            verifier.address,
            await token.getAddress(),
            await nft.getAddress(),
            60, // cooldown
            ethers.parseEther("1000"), // max convert out amount
            DOMAIN_NAME,
            DOMAIN_VERSION,
        );
        converterAddress = await converter.getAddress();

        // Fund converter contract
        await token.connect(owner).transfer(converterAddress, ethers.parseEther("1000"));

        domain = {
            name: DOMAIN_NAME,
            version: DOMAIN_VERSION,
            chainId: network.config.chainId as number,
            verifyingContract: converterAddress,
        };
    });

    const signConvertRequest = async (
        signer: any,
        userAddr: string,
        amountIn: string,
        amountOut: string,
        convertId: number,
        deadline: number,
        nonce: number,
    ) => {
        const types = {
            ConvertRequest: [
                { name: "user", type: "address" },
                { name: "amountIn", type: "uint256" },
                { name: "amountOut", type: "uint256" },
                { name: "convertId", type: "uint256" },
                { name: "deadline", type: "uint256" },
                { name: "nonce", type: "uint256" },
            ],
        };

        const value = {
            user: userAddr,
            amountIn,
            amountOut,
            convertId,
            deadline,
            nonce,
        };

        return await signer.signTypedData(domain, types, value);
    };

    it("should convert successfully with valid signature", async () => {
        const amountIn = ethers.parseEther("10");
        const amountOut = ethers.parseEther("20");
        const deadline = (await time.latest()) + 3600;
        const nonce = await converter.nonces(user.address);
        const convertId = 1;

        const signature = await signConvertRequest(
            verifier,
            user.address,
            amountIn.toString(),
            amountOut.toString(),
            convertId,
            deadline,
            nonce,
        );

        await expect(converter.connect(user).convert(amountIn, amountOut, convertId, deadline, signature))
            .to.emit(converter, "Converted")
            .withArgs(user.address, amountIn, amountOut, convertId, (await time.latest()) + 1); // +1 to avoid timestamp collision

        expect(await token.balanceOf(user.address)).to.equal(amountOut);
    });

    it("should revert if not NFT holder", async () => {
        const otherAddr = await other.getAddress();
        const amountIn = ethers.parseEther("5");
        const amountOut = ethers.parseEther("10");
        const deadline = (await time.latest()) + 3600;
        const convertId = 1;

        const signature = await signConvertRequest(
            verifier,
            otherAddr,
            amountIn.toString(),
            amountOut.toString(),
            convertId,
            deadline,
            0,
        );

        await expect(
            converter.connect(other).convert(amountIn, amountOut, convertId, deadline, signature),
        ).to.be.revertedWithCustomError(converter, "NotNftHolder");
    });

    it("should revert if signature is invalid", async () => {
        const userAddr = await user.getAddress();
        const amountIn = ethers.parseEther("10");
        const amountOut = ethers.parseEther("20");
        const deadline = (await time.latest()) + 3600;
        const convertId = 1;

        // wrong signer
        const invalidSignature = await signConvertRequest(
            other,
            userAddr,
            amountIn.toString(),
            amountOut.toString(),
            convertId,
            deadline,
            0,
        );

        await expect(
            converter.connect(user).convert(amountIn, amountOut, convertId, deadline, invalidSignature),
        ).to.be.revertedWithCustomError(converter, "InvalidSignature");
    });

    it("should revert if deadline passed", async () => {
        const userAddr = await user.getAddress();
        const amountIn = ethers.parseEther("10");
        const amountOut = ethers.parseEther("20");
        const deadline = (await time.latest()) - 10;
        const convertId = 1;

        const signature = await signConvertRequest(
            verifier,
            userAddr,
            amountIn.toString(),
            amountOut.toString(),
            convertId,
            deadline,
            0,
        );

        await expect(
            converter.connect(user).convert(amountIn, amountOut, convertId, deadline, signature),
        ).to.be.revertedWithCustomError(converter, "DeadlinePassed");
    });

    it("should revert if cooldown not over", async () => {
        const userAddr = await user.getAddress();
        const amountIn = ethers.parseEther("1");
        const amountOut = ethers.parseEther("2");
        const deadline = (await time.latest()) + 3600;
        const convertId = 1;

        const signature1 = await signConvertRequest(
            verifier,
            userAddr,
            amountIn.toString(),
            amountOut.toString(),
            convertId,
            deadline,
            0,
        );

        await converter.connect(user).convert(amountIn, amountOut, convertId, deadline, signature1);

        const convertId2 = 2;

        const signature2 = await signConvertRequest(
            verifier,
            userAddr,
            amountIn.toString(),
            amountOut.toString(),
            convertId2,
            deadline,
            1,
        );

        await expect(
            converter.connect(user).convert(amountIn, amountOut, convertId2, deadline, signature2),
        ).to.be.revertedWithCustomError(converter, "CooldownNotOver");
    });

    it("should allow owner to pause/unpause", async () => {
        await converter.connect(owner).pause();
        expect(await converter.paused()).to.be.true;

        await converter.connect(owner).unpause();
        expect(await converter.paused()).to.be.false;
    });

    it("should allow owner to withdraw tokens", async () => {
        const amount = ethers.parseEther("5");
        await expect(
            await converter.connect(owner).withdraw(await token.getAddress(), owner.address, amount),
        ).to.changeTokenBalances(token, [converter, owner], [-amount, amount]);
    });

    it("should allow owner to update verifier", async () => {
        const newVerifier = other.address;
        await expect(converter.connect(owner).updateVerifier(newVerifier)).to.emit(converter, "VerifierUpdated");

        expect(await converter.verifier()).to.equal(newVerifier);
    });
});
