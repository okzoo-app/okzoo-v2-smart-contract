import { expect } from "chai";
import { ethers, network } from "hardhat";
import { OkzooV2, OkzooV2__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EIP712Domain, EIP712TypeDefinition } from "../helpers/EIP712.type";
import { signTypedData } from "../helpers/EIP712";
import config from "../scripts/configs/OkzooV2";

enum EvolutionStage {
    Protoform,
    Infantile,
    Juvenile,
    Adolescent,
    Prime,
}

describe("OkzooV2", function () {
    let okzoo: OkzooV2;
    let okzooAddress: string;
    let owner: SignerWithAddress;
    let owner2: SignerWithAddress;
    let user: SignerWithAddress;
    let verifier: SignerWithAddress;

    beforeEach(async function () {
        [owner, owner2, user, verifier] = await ethers.getSigners();
        const OkzooV2 = <OkzooV2__factory>await ethers.getContractFactory("OkzooV2");
        okzoo = await OkzooV2.deploy();

        await okzoo.initialize(owner.address, verifier.address, config.domain, config.version);

        okzooAddress = await okzoo.getAddress();
    });

    it("should initialize with the correct verifier", async function () {
        expect(await okzoo.verifier()).to.equal(verifier.address);
    });
    it("should initialize with the correct owner", async function () {
        expect(await okzoo.owner()).to.equal(owner.address);
    });
    it("should set verifier with the correct address", async function () {
        await okzoo.connect(owner).setVerifier(owner2.address);
        expect(await okzoo.verifier()).to.equal(owner2.address);
    });

    describe("Check-in", function () {
        it("Should allow a new user to check in", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline, signature);
            const streak = await okzoo.getStreak(user.address);
            expect(streak).to.equal(1);
        });

        it("should allow user to check-in with valid signature", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );

            await okzoo.connect(user).checkIn(deadline, signature);
            const streak = await okzoo.getStreak(user.address);
            expect(streak).to.equal(1);
        });

        it("should not allow check-in with expired deadline", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) - 1; // Set deadline to the past

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );

            await expect(okzoo.connect(user).checkIn(deadline, signature)).to.be.revertedWithCustomError(
                okzoo,
                "DeadlinePassed",
            );
        });

        it("Should revert if user checks in with duplicate signature", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline, signature);

            await expect(okzoo.connect(user).checkIn(deadline, signature)).to.be.revertedWithCustomError(
                okzoo,
                "InvalidSignature",
            );
        });

        it("Should revert if user checks in twice on the same day", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline, signature);
            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getCheckInSignature(
                user.address,
                BigInt(deadline2),
                BigInt(nonce2),
                okzooAddress,
                verifier,
            );
            await expect(okzoo.connect(user).checkIn(deadline2, signature2)).to.be.revertedWithCustomError(
                okzoo,
                "AlreadyCheckin",
            );
        });

        it("Should reset streak if user missed a day", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline, signature);
            await time.increase(86400 * 2); // Skip 2 days

            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getCheckInSignature(
                user.address,
                BigInt(deadline2),
                BigInt(nonce2),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline2, signature2);
            const streak = await okzoo.getStreak(user.address);
            expect(streak).to.equal(1);
        });

        it("Should return the correct streak if user missed 2 days", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline, signature);
            await time.increase(86400 * 2); // Skip 2 days

            const streak = await okzoo.getStreak(user.address);
            expect(streak).to.equal(0);
        });
    });

    describe("Bonus", function () {
        it("Should allow claiming bonus after 7-day streak", async function () {
            for (let i = 0; i < 7; i++) {
                const nonce = await okzoo.nonces(user.address);
                const deadline = (await time.latest()) + 1000;

                const signature = await getCheckInSignature(
                    user.address,
                    BigInt(deadline),
                    BigInt(nonce),
                    okzooAddress,
                    verifier,
                );
                await okzoo.connect(user).checkIn(deadline, signature);
                await time.increase(86400);
            }
            expect(await okzoo.getPendingBonus(user.address)).to.equal(true);

            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );

            await okzoo.connect(user).streakMilestone(deadline, signature);
            expect(await okzoo.getPendingBonus(user.address)).to.equal(false);
        });

        it("Should revert if no bonus is available", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).checkIn(deadline, signature);

            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getCheckInSignature(
                user.address,
                BigInt(deadline2),
                BigInt(nonce2),
                okzooAddress,
                verifier,
            );
            await expect(okzoo.connect(user).streakMilestone(deadline2, signature2)).to.be.revertedWithCustomError(
                okzoo,
                "StreakMilestoneNotReached",
            );
        });
        it("Should revert if user does not exist", async function () {
            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getCheckInSignature(
                user.address,
                BigInt(deadline),
                BigInt(nonce),
                okzooAddress,
                verifier,
            );

            await expect(okzoo.connect(user).streakMilestone(deadline, signature)).to.be.revertedWithCustomError(
                okzoo,
                "StreakMilestoneNotReached",
            );
        });
    });

    describe("Evolution", function () {
        it("Should evolve user to the next stage with valid signature", async function () {
            // const nonce = await okzoo.nonces(user.address);
            // const deadline = (await time.latest()) + 1000;

            // const signature = await getCheckInSignature(
            //     user.address,
            //     BigInt(deadline),
            //     BigInt(nonce),
            //     okzooAddress,
            //     verifier,
            // );
            // await okzoo.connect(user).checkIn(deadline, signature);

            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getEvolveSignature(
                user.address,
                EvolutionStage.Infantile,
                BigInt(deadline2),
                nonce2,
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline2, signature2);
            const userStage = await okzoo.getStage(user.address);
            expect(userStage).to.equal(EvolutionStage.Infantile);
        });
        // it("Should revert if user does not exist", async function () {
        //     const nonce = await okzoo.nonces(user.address);
        //     const deadline = (await time.latest()) + 1000;

        //     const signature = await getEvolveSignature(
        //         user.address,
        //         EvolutionStage.Infantile,
        //         BigInt(deadline),
        //         BigInt(nonce),
        //         okzooAddress,
        //         verifier,
        //     );

        //     await expect(
        //         okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline, signature),
        //     ).to.be.revertedWithCustomError(okzoo, "UserDoesNotExist");
        // });
        it("should not allow evolution without correct signature", async function () {
            // const nonce = await okzoo.nonces(user.address);
            // const deadline = (await time.latest()) + 1000;

            // const signature = await getCheckInSignature(
            //     user.address,
            //     BigInt(deadline),
            //     BigInt(nonce),
            //     okzooAddress,
            //     verifier,
            // );
            // await okzoo.connect(user).checkIn(deadline, signature);

            const deadline2 = (await time.latest()) + 1000;

            const invalidSignature =
                "0xfc6c39c23082ea2ae5f4e6fd9530762fad051eebd43efd77c26fc38f8cfb07d05730f923f6a79587408ac5e71f7c580e65c7e7932bbe0e6a8a6c4f72357c0fb21b"; // Invalid signature

            await expect(okzoo.connect(user).evolve(1, deadline2, invalidSignature)).to.be.revertedWithCustomError(
                okzoo,
                "InvalidSignature",
            );
        });
        it("Should revert if user tries to evolve to the same stage", async function () {
            // const nonce = await okzoo.nonces(user.address);
            // const deadline = (await time.latest()) + 1000;

            // const signature = await getCheckInSignature(
            //     user.address,
            //     BigInt(deadline),
            //     BigInt(nonce),
            //     okzooAddress,
            //     verifier,
            // );
            // await okzoo.connect(user).checkIn(deadline, signature);

            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getEvolveSignature(
                user.address,
                EvolutionStage.Infantile,
                BigInt(deadline2),
                nonce2,
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline2, signature2);

            const nonce3 = await okzoo.nonces(user.address);
            const deadline3 = (await time.latest()) + 1000;

            const signature3 = await getEvolveSignature(
                user.address,
                EvolutionStage.Infantile,
                BigInt(deadline3),
                nonce3,
                okzooAddress,
                verifier,
            );

            await expect(
                okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline3, signature3),
            ).to.be.revertedWithCustomError(okzoo, "AlreadyEvolved");
        });
        it("Should revert if user tries to evolve to a lower stage", async function () {
            // const nonce = await okzoo.nonces(user.address);
            // const deadline = (await time.latest()) + 1000;

            // const signature = await getCheckInSignature(
            //     user.address,
            //     BigInt(deadline),
            //     BigInt(nonce),
            //     okzooAddress,
            //     verifier,
            // );
            // await okzoo.connect(user).checkIn(deadline, signature);

            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getEvolveSignature(
                user.address,
                EvolutionStage.Infantile,
                BigInt(deadline2),
                nonce2,
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline2, signature2);

            const nonce3 = await okzoo.nonces(user.address);
            const deadline3 = (await time.latest()) + 1000;

            const signature3 = await getEvolveSignature(
                user.address,
                EvolutionStage.Protoform,
                BigInt(deadline3),
                nonce3,
                okzooAddress,
                verifier,
            );

            await expect(
                okzoo.connect(user).evolve(EvolutionStage.Protoform, deadline3, signature3),
            ).to.be.revertedWithCustomError(okzoo, "AlreadyEvolved");
        });
        it("Should revert if user tries to evolve to higher stage", async function () {
            // const nonce = await okzoo.nonces(user.address);
            // const deadline = (await time.latest()) + 1000;

            // const signature = await getCheckInSignature(
            //     user.address,
            //     BigInt(deadline),
            //     BigInt(nonce),
            //     okzooAddress,
            //     verifier,
            // );
            // await okzoo.connect(user).checkIn(deadline, signature);

            const nonce2 = await okzoo.nonces(user.address);
            const deadline2 = (await time.latest()) + 1000;

            const signature2 = await getEvolveSignature(
                user.address,
                EvolutionStage.Infantile,
                BigInt(deadline2),
                nonce2,
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline2, signature2);

            const nonce3 = await okzoo.nonces(user.address);
            const deadline3 = (await time.latest()) + 1000;

            const signature3 = await getEvolveSignature(
                user.address,
                EvolutionStage.Adolescent,
                BigInt(deadline3),
                nonce3,
                okzooAddress,
                verifier,
            );

            await expect(
                okzoo.connect(user).evolve(EvolutionStage.Adolescent, deadline3, signature3),
            ).to.be.revertedWithCustomError(okzoo, "AlreadyEvolved");
        });
    });
});

const getCheckInSignature = async (
    user: string,
    deadline: bigint,
    nonce: bigint,
    verifyingContract: string,
    signer: SignerWithAddress,
): Promise<string> => {
    const chainId = network.config.chainId as number; // the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.

    const checkinTypes: EIP712TypeDefinition = {
        CheckInRequest: [
            { name: "user", type: "address" },
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

    const checkinRequest = {
        user: user,
        deadline: deadline,
        nonce: nonce,
    };

    const signature = await signTypedData(domain, checkinTypes, checkinRequest, signer);

    return signature;
};

const getEvolveSignature = async (
    user: string,
    stage: EvolutionStage,
    deadline: bigint,
    nonce: bigint,
    verifyingContract: string,
    signer: SignerWithAddress,
): Promise<string> => {
    const chainId = network.config.chainId as number; // the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.

    const evolveTypes: EIP712TypeDefinition = {
        EvolveRequest: [
            { name: "user", type: "address" },
            { name: "stage", type: "uint8" },
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

    const evolveRequest = {
        user: user,
        stage: stage,
        deadline: deadline,
        nonce: nonce,
    };

    const signature = await signTypedData(domain, evolveTypes, evolveRequest, signer);

    return signature;
};
