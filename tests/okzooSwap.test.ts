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

    it("should initialize correctly", async () => {
        expect(await okzooSwap.owner()).to.equal(owner.address);
        expect(await okzooSwap.swapToken()).to.equal(swapTokenAddress);
        expect(await okzooSwap.verifier()).to.equal(verifier.address);

        const eip712Domain = await okzooSwap.eip712Domain();

        expect(eip712Domain.name).to.equal(config.domain);
        expect(eip712Domain.version).to.equal(config.version);
    });

    it("should create a valid swap and allow claiming", async () => {
        const now = await time.latest();

        const nonce = await okzooSwap.nonces(user.address);

        const input = parseEther("10");
        const output = parseEther("20");
        const lockTime = 1000n; // seconds
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
        // await okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature);
        await expect(okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature)).to.emit(
            okzooSwap,
            "Swapped",
        );
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

        await expect(okzooSwap.connect(user).swap(input, output, lockTime, swapRequestId, deadline, signature)).to.emit(
            okzooSwap,
            "Swapped",
        );

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

    // it("should prevent reuse of a swap/claim signature", async () => {
    //     const input = ethers.utils.parseEther("10");
    //     const output = ethers.utils.parseEther("20");
    //     const lockTime = 3;
    //     const deadline = Math.floor(Date.now() / 1000) + 3600;

    //     const sig = await signSwapRequest({
    //         inputAmount: input.toNumber(),
    //         outputAmount: output.toNumber(),
    //         swapLockTime: lockTime,
    //         deadline,
    //         nonce: 0,
    //     });

    //     await okzooSwap.connect(user).swap(input, output, lockTime, deadline, sig);

    //     const requestId = (await okzooSwap.getUserSwapRequests(userAddress))[0];

    //     await ethers.provider.send("evm_increaseTime", [lockTime + 1]);
    //     await ethers.provider.send("evm_mine", []);

    //     const claimSig = await signClaimRequest({
    //         swapRequestId: requestId,
    //         deadline,
    //         nonce: 1,
    //     });

    //     await okzooSwap.connect(user).claim(requestId, deadline, claimSig);

    //     await expect(okzooSwap.connect(user).claim(requestId, deadline, claimSig)).to.be.revertedWith(
    //         "AlreadyClaimed()",
    //     );
    // });

    // it("should allow only owner to withdraw", async () => {
    //     const amount = ethers.utils.parseEther("1");
    //     const recipient = await other.getAddress();

    //     await expect(okzooSwap.connect(other).withdraw(swapToken.address, recipient, amount)).to.be.revertedWith(
    //         "Ownable: caller is not the owner",
    //     );

    //     await expect(okzooSwap.connect(owner).withdraw(swapToken.address, recipient, amount)).to.emit(
    //         okzooSwap,
    //         "Withdrawn",
    //     );
    // });

    // it("should not allow setting zero verifier", async () => {
    //     await expect(okzooSwap.connect(owner).setVerifier(ethers.constants.AddressZero)).to.be.revertedWith(
    //         "ZeroAddress()",
    //     );
    // });
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
