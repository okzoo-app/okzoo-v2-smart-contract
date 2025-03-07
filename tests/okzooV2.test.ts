import { expect } from "chai";
import { ethers } from "hardhat";
import { OkzooV2, OkzooV2__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OkzooV2", function () {
    let okzooV2: OkzooV2;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();
        const OkzooV2 = <OkzooV2__factory>await ethers.getContractFactory("OkzooV2");
        okzooV2 = await OkzooV2.deploy();
    });

    it("Should allow user to check in and track streak", async function () {
        await okzooV2.connect(user1).checkIn();
        expect(await okzooV2.getStreak(user1.address)).to.equal(1);
    });

    it("Should prevent double check-in on the same day", async function () {
        await okzooV2.connect(user1).checkIn();
        await expect(okzooV2.connect(user1).checkIn()).to.be.revertedWithCustomError(okzooV2, "AlreadyCheckin");
    });

    it("Should require claiming bonus before next check-in", async function () {
        for (let i = 0; i < 7; i++) {
            await okzooV2.connect(user1).checkIn();
            await ethers.provider.send("evm_increaseTime", [86400]); // Simulate 1 day
            await ethers.provider.send("evm_mine");
        }
        expect(await okzooV2.getPendingBonus(user1.address)).to.equal(true);
        await expect(okzooV2.connect(user1).checkIn()).to.be.revertedWithCustomError(
            okzooV2,
            "MustClaimBonusBeforeCheckin",
        );
    });

    it("Should allow claiming bonus and reset pendingBonus", async function () {
        for (let i = 0; i < 7; i++) {
            await okzooV2.connect(user1).checkIn();
            await ethers.provider.send("evm_increaseTime", [86400]); // Simulate 1 day
            await ethers.provider.send("evm_mine");
        }
        await okzooV2.connect(user1).bonus();
        expect(await okzooV2.getPendingBonus(user1.address)).to.equal(false);
    });

    it("Should reset streak if bonus is not claimed in time", async function () {
        for (let i = 0; i < 7; i++) {
            await okzooV2.connect(user1).checkIn();
            await ethers.provider.send("evm_increaseTime", [86400]); // Simulate 1 day
            await ethers.provider.send("evm_mine");
        }
        await ethers.provider.send("evm_increaseTime", [86400]); // Simulate 1 day
        await ethers.provider.send("evm_mine");
        await expect(okzooV2.connect(user1).checkIn()).to.be.revertedWithCustomError(
            okzooV2,
            "MustClaimBonusBeforeCheckin",
        );
        await ethers.provider.send("evm_increaseTime", [86400]); // Simulate another day
        await ethers.provider.send("evm_mine");
        await okzooV2.connect(user1).bonus(); // Bonus claim after 2 days
        expect(await okzooV2.getStreak(user1.address)).to.equal(1); // Streak should reset
    });
});
