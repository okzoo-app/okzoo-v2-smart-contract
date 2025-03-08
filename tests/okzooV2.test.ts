import { expect } from "chai";
import { ethers, network } from "hardhat";
import { OkzooV2, OkzooV2__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EIP712Domain, EIP712TypeDefinition } from "../helpers/EIP712.type";
import { ConfigOkzooV2 } from "../scripts/config";
import { signTypedData } from "../helpers/EIP712";

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
    let user: SignerWithAddress;
    let verifier: SignerWithAddress;

    beforeEach(async function () {
        [user, verifier] = await ethers.getSigners();
        const OkzooV2 = <OkzooV2__factory>await ethers.getContractFactory("OkzooV2");
        okzoo = await OkzooV2.deploy();

        await okzoo.initialize(verifier.address, ConfigOkzooV2.domain, ConfigOkzooV2.version);

        okzooAddress = await okzoo.getAddress();
    });

    describe("Check-in", function () {
        it("Should allow a new user to check in", async function () {
            await okzoo.connect(user).checkIn();
            const streak = await okzoo.getStreak(user.address);
            expect(streak).to.equal(1);
        });

        it("Should revert if user checks in twice on the same day", async function () {
            await okzoo.connect(user).checkIn();
            await expect(okzoo.connect(user).checkIn()).to.be.revertedWithCustomError(okzoo, "AlreadyCheckin");
        });

        it("Should reset streak if user misses a day", async function () {
            await okzoo.connect(user).checkIn();
            await time.increase(86400 * 2); // Skip 2 days
            await okzoo.connect(user).checkIn();
            const streak = await okzoo.getStreak(user.address);
            expect(streak).to.equal(1);
        });
    });

    describe("Bonus", function () {
        it("Should allow claiming bonus after 7-day streak", async function () {
            for (let i = 0; i < 7; i++) {
                await okzoo.connect(user).checkIn();
                await time.increase(86400);
            }
            expect(await okzoo.getPendingBonus(user.address)).to.equal(true);
            await okzoo.connect(user).bonus();
            expect(await okzoo.getPendingBonus(user.address)).to.equal(false);
        });

        it("Should revert if no bonus is available", async function () {
            await okzoo.connect(user).checkIn();
            await expect(okzoo.connect(user).bonus()).to.be.revertedWithCustomError(okzoo, "NoBonusAvailable");
        });
    });

    describe("Evolution", function () {
        it("Should evolve user to the next stage with valid signature", async function () {
            await okzoo.connect(user).checkIn();

            // const stage = await okzoo.getStage(user.address);
            // console.log({ stage });

            const nonce = await okzoo.nonces(user.address);
            const deadline = (await time.latest()) + 1000;

            const signature = await getEvolveSignature(
                user.address,
                BigInt(1),
                BigInt(deadline),
                nonce,
                okzooAddress,
                verifier,
            );
            await okzoo.connect(user).evolve(EvolutionStage.Infantile, deadline, signature);
            const userStage = await okzoo.getStage(user.address);
            expect(userStage).to.equal("Infantile");
        });
    });
});

const getEvolveSignature = async (
    user: string,
    stage: bigint,
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
        name: ConfigOkzooV2.domain,
        version: ConfigOkzooV2.version,
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
