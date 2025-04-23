import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { OkzooSwap, ERC20 } from "../typechain-types";
import { keccak256, parseEther, Signer, solidityPackedKeccak256 } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { EIP712Domain, EIP712TypeDefinition } from "../helpers/EIP712.type";
import config from "../scripts/configs/OkzooSwap";
import { signTypedData } from "../helpers/EIP712";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("OkzooSwap", function () {
    let okzooSwap: OkzooSwap;
    let okzooSwapAddress: string;
    let swapToken: ERC20;
    let swapTokenAddress: string;
    let owner: SignerWithAddress, user: SignerWithAddress, verifier: SignerWithAddress, other: SignerWithAddress;

    const input = parseEther("10");
    const output = parseEther("20");
    const lockTime = 1000n; // seconds

    beforeEach(async () => {
        [owner, user, verifier, other] = await ethers.getSigners();

        const ERC20Mock = await ethers.getContractFactory("ERC20Token");
        swapToken = await ERC20Mock.deploy("Swap Token", "STT", parseEther("1000000"), owner.address);
        swapTokenAddress = await swapToken.getAddress();

        const OkzooSwap = await ethers.getContractFactory("OkzooSwap");
        okzooSwap = await OkzooSwap.deploy();
        okzooSwapAddress = await okzooSwap.getAddress();
        await okzooSwap.initialize(owner.address, swapTokenAddress, verifier.address, config.domain, config.version);

        // Transfer some tokens to contract for claiming
        await swapToken.connect(owner).transfer(okzooSwapAddress, parseEther("500"));
    });

    describe("Initialization", function () {
        it("should initialize correctly", async () => {
            expect(await okzooSwap.owner()).to.equal(owner.address);
            expect(await okzooSwap.swapToken()).to.equal(swapTokenAddress);
            expect(await okzooSwap.verifier()).to.equal(verifier.address);

            const eip712Domain = await okzooSwap.eip712Domain();

            expect(eip712Domain.name).to.equal(config.domain);
            expect(eip712Domain.version).to.equal(config.version);
        });
    });

    describe("Swap", function () {
        it("should revert if the okzoo swap is paused", async function () {
            await okzooSwap.connect(owner).pause();

            const now = await time.latest();
            const nonce = await okzooSwap.nonces(user.address);
            const deadline = now + 1000;

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );

            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.rejectedWith("Pausable: paused");
        });

        it("should allow user to create a swap request", async function () {
            const now = await time.latest();
            const nonce = await okzooSwap.nonces(user.address);
            const deadline = now + 1000;

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );

            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.emit(okzooSwap, "Swapped");
        });

        it("should create a valid swap", async () => {
            const now = await time.latest();

            const nonce = await okzooSwap.nonces(user.address);

            const deadline = now + 1000;

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );
            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.emit(okzooSwap, "Swapped");

            const swapRequests = await okzooSwap.getUserSwapRequests(user.address);
            expect(swapRequests.length).to.equal(1);
        });

        it("should revert with InvalidSignature when signature is invalid", async function () {
            const now = await time.latest();
            const nonce = await okzooSwap.nonces(user.address);
            const deadline = now + 1000;

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);
            const invalidSignature =
                "0xa599bbd1a74f1f2cc53e4d734035b1145096bab4a420f626bcfe72be8ec17d566605458acf3aba63baa9814c05b4c5c48cf1a00992f843cda36a2bd52b5732d21b"; // Fake signature
            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, invalidSignature),
            ).to.revertedWithCustomError(okzooSwap, "InvalidSignature");
        });

        it("should reject claims before lock time", async () => {
            const now = await time.latest();

            const input = parseEther("10");
            const output = parseEther("20");
            const lockTime = 60n;
            const deadline = (await time.latest()) + 1000;
            const nonce = await okzooSwap.nonces(user.address);

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );

            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.emit(okzooSwap, "Swapped");

            const deadlineClaim = (await time.latest()) + 1000;
            const nonceClaim = await okzooSwap.nonces(user.address);

            const signatureClaim = await getClaimSignature(
                user.address,
                swapRequestId,
                BigInt(deadlineClaim),
                nonceClaim,
                okzooSwapAddress,
                verifier,
            );

            await expect(
                okzooSwap.connect(user).claim(swapRequestId, deadlineClaim, signatureClaim),
            ).to.be.revertedWithCustomError(okzooSwap, "ClaimTimeNotReached");
        });

        it("should reject swap after deadline", async () => {
            const now = await time.latest();

            const deadline = now - 1000;
            const nonce = await okzooSwap.nonces(user.address);

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );

            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.revertedWithCustomError(okzooSwap, "DeadlinePassed");
        });
    });

    describe("Claim", function () {
        it("should allow user to claim tokens after lock time", async function () {
            const now = await time.latest();

            const nonce = await okzooSwap.nonces(user.address);

            const deadline = now + 1000;

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );
            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.emit(okzooSwap, "Swapped");

            const swapRequests = await okzooSwap.getUserSwapRequests(user.address);
            expect(swapRequests.length).to.equal(1);

            await time.increase(Number(lockTime) + 1); // Fast forward time to after the lock period

            const nonceClaim = await okzooSwap.nonces(user.address);
            const deadlineClaim = (await time.latest()) + 1000;

            const signatureClaim = await getClaimSignature(
                user.address,
                swapRequestId,
                BigInt(deadlineClaim),
                nonceClaim,
                okzooSwapAddress,
                verifier,
            );

            await expect(okzooSwap.connect(user).claim(swapRequestId, deadlineClaim, signatureClaim)).to.emit(
                okzooSwap,
                "Claimed",
            );
        });

        it("should prevent reuse of a swap/claim signature", async () => {
            const now = await time.latest();

            const nonce = await okzooSwap.nonces(user.address);

            const deadline = now + 1000;

            const swapRequestId = generateSwapRequestId(user.address, input, output, lockTime, nonce, now);

            const signature = await getSwapSignature(
                user.address,
                input,
                output,
                lockTime,
                swapRequestId,
                BigInt(deadline),
                nonce,
                okzooSwapAddress,
                verifier,
            );
            await expect(
                okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature),
            ).to.emit(okzooSwap, "Swapped");

            const swapRequests = await okzooSwap.getUserSwapRequests(user.address);
            expect(swapRequests.length).to.equal(1);

            await time.increase(Number(lockTime) + 1); // Fast forward time to after the lock period

            const nonceClaim1 = await okzooSwap.nonces(user.address);
            const deadlineClaim1 = (await time.latest()) + 1000;

            const signatureClaim1 = await getClaimSignature(
                user.address,
                swapRequestId,
                BigInt(deadlineClaim1),
                nonceClaim1,
                okzooSwapAddress,
                verifier,
            );

            await expect(okzooSwap.connect(user).claim(swapRequestId, deadlineClaim1, signatureClaim1)).to.emit(
                okzooSwap,
                "Claimed",
            );

            const nonceClaim2 = await okzooSwap.nonces(user.address);
            const deadlineClaim2 = (await time.latest()) + 1000;

            const signatureClaim2 = await getClaimSignature(
                user.address,
                swapRequestId,
                BigInt(deadlineClaim2),
                nonceClaim2,
                okzooSwapAddress,
                verifier,
            );

            await expect(
                okzooSwap.connect(user).claim(swapRequestId, deadlineClaim2, signatureClaim2),
            ).to.be.revertedWithCustomError(okzooSwap, "AlreadyClaimed");
        });
    });

    describe("Emergency Withdrawals", function () {
        it("should allow owner to withdraw tokens", async function () {
            const balanceBefore = await swapToken.balanceOf(owner.address);
            const contractBalanceBefore = await swapToken.balanceOf(okzooSwapAddress);

            await okzooSwap.connect(owner).withdraw(swapTokenAddress, owner.address, parseEther("100"));

            const balanceAfter = await swapToken.balanceOf(owner.address);
            const contractBalanceAfter = await swapToken.balanceOf(okzooSwapAddress);
            expect(balanceAfter).to.be.equal(balanceBefore + parseEther("100"));
            expect(contractBalanceAfter).to.be.equal(contractBalanceBefore - parseEther("100"));
        });

        it("should revert if a non-owner tries to withdraw tokens", async function () {
            const withdraw = okzooSwap.connect(user).withdraw(swapToken, user.address, parseEther("100"));
            await expect(withdraw).to.be.rejectedWith("Ownable: caller is not the owner");
        });
    });
});

const getSwapSignature = async (
    user: string,
    inputAmount: bigint,
    outputAmount: bigint,
    swapLockTime: bigint,
    swapRequestId: string,
    deadline: bigint,
    nonce: bigint,
    verifyingContract: string,
    signer: SignerWithAddress,
): Promise<string> => {
    const chainId = network.config.chainId as number; // the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.

    const swapTypes: EIP712TypeDefinition = {
        SwapRequest: [
            { name: "user", type: "address" },
            { name: "inputAmount", type: "uint256" },
            { name: "outputAmount", type: "uint256" },
            { name: "swapLockTime", type: "uint256" },
            { name: "swapRequestId", type: "bytes32" },
            { name: "deadline", type: "uint256" },
            { name: "nonce", type: "uint256" },
        ],
    };

    const domain: EIP712Domain = {
        name: config.domain,
        version: config.version,
        chainId: chainId,
        verifyingContract: verifyingContract,
    };

    const swapRequest = {
        user: user,
        inputAmount: inputAmount,
        outputAmount: outputAmount,
        swapLockTime: swapLockTime,
        swapRequestId: swapRequestId,
        deadline: deadline,
        nonce: nonce,
    };

    const signature = await signTypedData(domain, swapTypes, swapRequest, signer);

    return signature;
};

const getClaimSignature = async (
    user: string,
    swapRequestId: string,
    deadline: bigint,
    nonce: bigint,
    verifyingContract: string,
    signer: SignerWithAddress,
): Promise<string> => {
    const chainId = network.config.chainId as number; // the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.

    const claimTypes: EIP712TypeDefinition = {
        ClaimRequest: [
            { name: "user", type: "address" },
            { name: "swapRequestId", type: "bytes32" },
            { name: "deadline", type: "uint256" },
            { name: "nonce", type: "uint256" },
        ],
    };

    const domain: EIP712Domain = {
        name: config.domain,
        version: config.version,
        chainId: chainId,
        verifyingContract: verifyingContract,
    };

    const claimRequest = {
        user: user,
        swapRequestId: swapRequestId,
        deadline: deadline,
        nonce: nonce,
    };

    const signature = await signTypedData(domain, claimTypes, claimRequest, signer);

    return signature;
};

function generateSwapRequestId(
    user: string,
    inputAmount: bigint,
    outputAmount: bigint,
    swapLockTime: bigint,
    nonce: bigint,
    timestamp: number,
): string {
    return keccak256(
        solidityPackedKeccak256(
            ["address", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [user, inputAmount, outputAmount, swapLockTime, nonce, timestamp],
        ),
    );
}
