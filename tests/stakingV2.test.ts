import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { formatEther, parseEther } from "ethers";

describe("StakingV2", () => {
    let staking: any, token: any, reward: any;
    let stakingAddress: string;

    let owner: any, user: any;
    const totalReward = parseEther("5000");
    const lockDuration = 15 * 24 * 60 * 60; // 15 days
    const maxStake = parseEther("100000");
    const minStake = parseEther("1"); // Minimum stake amount

    let startTime: number;
    let endTime: number;

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("OkzooToken");
        token = await Token.deploy("Stake", "STK", parseEther("100000"), owner.address);
        reward = await Token.deploy("Reward", "RWD", parseEther("100000"), owner.address);

        const tokenAddress = await token.getAddress();
        const rewardAddress = await reward.getAddress();

        const now = await time.latest();
        const start = now + 10;
        const end = start + 30 * 24 * 60 * 60; // 30 days
        startTime = start;
        endTime = end;

        const maxStakePerUser = 100;

        const Staking = await ethers.getContractFactory("StakingV2");
        staking = await Staking.deploy();
        stakingAddress = await staking.getAddress();

        await staking.initialize(
            owner.address,
            tokenAddress,
            rewardAddress,
            totalReward,
            startTime,
            endTime,
            lockDuration,
            maxStake,
            minStake,
            maxStakePerUser,
        );

        // Fund staking contract
        await reward.transfer(stakingAddress, totalReward);
        await token.transfer(user.address, parseEther("100000"));
    });

    it("should give correct rewards based on dynamic APR", async () => {
        await token.connect(user).approve(stakingAddress, parseEther("1000000"));

        await time.increaseTo(await staking.startTime());
        await staking.connect(user).stake(parseEther("10000"));

        await time.increase(64800);
        await staking.connect(user).stake(parseEther("2000"));

        await time.increase(72000);
        await staking.connect(user).stake(parseEther("15000"));

        await time.increase(792600);
        await staking.connect(user).stake(parseEther("5000"));

        await time.increase(86400);
        await staking.connect(user).stake(parseEther("35000"));

        await time.increase(212400);
        await staking.connect(user).stake(parseEther("18000"));

        await time.increase(204600);
        await staking.connect(user).unstake(0);

        const rewardBalance = await reward.balanceOf(user.address);
        console.log({ rewardBalance: formatEther(rewardBalance) });

        await time.increase(86460);
        await staking.connect(user).unstake(1);

        await time.increase(69540);
        await staking.connect(user).stake(parseEther("3000"));

        await time.increase(34200);
        await staking.connect(user).stake(parseEther("2500"));

        await time.increase(170400);
        await staking.connect(user).stake(parseEther("12345"));

        await time.increase(74400);
        await staking.connect(user).stake(parseEther("4155"));

        // const tokenBalance = await token.balanceOf(user.address);
        // console.log({ tokenBalance: formatEther(tokenBalance) });

        await time.increase(345600);
        await staking.connect(user).stake(parseEther("5000"));

        await time.increase(170100);
        await staking.connect(user).unstake(3);

        await time.increase(2700);
        await staking.connect(user).stake(parseEther("123"));

        await time.increase(2761920);
        await staking.connect(user).unstake(2);

        await time.increase(1382280);
        await staking.connect(user).unstake(4);

        const rewardBalance2 = await reward.balanceOf(user.address);
        console.log({ rewardBalance2: formatEther(rewardBalance2) });

        await time.increase(86400);
        await staking.connect(user).unstake(5);
        await staking.connect(user).unstake(6);
        await staking.connect(user).unstake(7);
        await staking.connect(user).unstake(8);
        await staking.connect(user).unstake(9);
        await staking.connect(user).unstake(10);
        await staking.connect(user).unstake(11);

        const rewardBalanceEnd1 = await reward.balanceOf(user.address);
        console.log({ rewardBalanceEnd1: formatEther(rewardBalanceEnd1) });
        expect(rewardBalanceEnd1).to.be.gt(0); // Ensure some reward was earned
    });
    it("should give correct rewards based on dynamic APR 2", async () => {
        await token.connect(user).approve(stakingAddress, parseEther("1000000"));

        await time.increaseTo(await staking.startTime());
        await staking.connect(user).stake(parseEther("10000"));

        await time.increase(64800);
        await staking.connect(user).stake(parseEther("2000"));

        await time.increase(72000);
        await staking.connect(user).stake(parseEther("30000"));

        await time.increase(432000);
        await staking.connect(user).unstake(0);

        await time.increase(360600);
        await staking.connect(user).stake(parseEther("5000"));

        await time.increase(86400);
        await staking.connect(user).stake(parseEther("25000"));

        await time.increase(212400);
        await staking.connect(user).stake(parseEther("11000"));

        await time.increase(31800);
        await staking.connect(user).unstake(4);

        await time.increase(259260);
        await staking.connect(user).unstake(1);

        await time.increase(69540);
        await staking.connect(user).stake(parseEther("3000"));

        await time.increase(34200);
        await staking.connect(user).stake(parseEther("2500"));

        await time.increase(69120);
        await staking.connect(user).unstake(2);

        await time.increase(101280);
        await staking.connect(user).stake(parseEther("18000"));

        await time.increase(71400);
        await staking.connect(user).unstake(5);

        await time.increase(3000);
        await staking.connect(user).stake(parseEther("8900"));

        await time.increase(345600);
        await staking.connect(user).stake(parseEther("40000"));

        await time.increase(170100);
        await staking.connect(user).unstake(3);

        await time.increase(2700);
        await staking.connect(user).stake(parseEther("123"));

        await time.increase(4230600);
        await staking.connect(user).unstake(6);
        await staking.connect(user).unstake(7);
        await staking.connect(user).unstake(8);
        await staking.connect(user).unstake(9);
        await staking.connect(user).unstake(10);
        await staking.connect(user).unstake(11);

        const rewardBalanceEnd2 = await reward.balanceOf(user.address);
        console.log({ rewardBalanceEnd2: formatEther(rewardBalanceEnd2) });
        expect(rewardBalanceEnd2).to.be.gt(0); // Ensure some reward was earned
    });

    it("should allow staking and track user stake", async () => {
        await time.increaseTo(await staking.startTime());
        await token.connect(user).approve(stakingAddress, parseEther("100"));
        await staking.connect(user).stake(parseEther("50"));

        const stakes = await staking.getUserStakes(user.address);
        console.log({ stakes });
        expect(stakes[0].amount).to.equal(parseEther("50"));
    });

    it("should give correct reward after unlock", async () => {
        // const rewardBalanceBefore = await reward.balanceOf(user.address);
        // console.log({ rewardBalanceBefore: formatEther(rewardBalanceBefore) });
        await time.increaseTo(await staking.startTime());
        await token.connect(user).approve(stakingAddress, parseEther("10000"));
        await staking.connect(user).stake(parseEther("10000"));

        // Wait for > lock duration
        await time.increase(lockDuration);
        await staking.connect(user).unstake(0);

        const rewardBalance = await reward.balanceOf(user.address);
        console.log({ rewardBalance: formatEther(rewardBalance) });
        expect(rewardBalance).to.be.gt(0); // reward received
    });

    it("should not give reward before unlock time", async () => {
        await time.increaseTo(await staking.startTime());
        await token.connect(user).approve(stakingAddress, parseEther("100"));
        await staking.connect(user).stake(parseEther("50"));

        await time.increase(lockDuration / 2); // Not fully unlocked
        await staking.connect(user).unstake(0);

        const rewardBalance = await reward.balanceOf(user.address);
        expect(rewardBalance).to.equal(0); // No reward yet
    });

    it("should reject stake beyond maxActiveStake", async () => {
        await time.increaseTo(await staking.startTime());
        await token.connect(user).approve(stakingAddress, maxStake + 1n);
        await expect(staking.connect(user).stake(maxStake + 1n)).to.be.revertedWithCustomError(
            staking,
            "MaxStakeReached",
        );
    });

    it("should revert staking before start time", async () => {
        const stakeAmount = parseEther("10");
        await token.connect(user).approve(stakingAddress, stakeAmount);
        await expect(staking.connect(user).stake(stakeAmount)).to.be.revertedWithCustomError(
            staking,
            "NotInStakingPeriod",
        );
    });

    it("should prevent double unstake", async () => {
        await time.increaseTo(await staking.startTime());

        const stakeAmount = parseEther("10");
        await token.connect(user).approve(stakingAddress, stakeAmount);
        await staking.connect(user).stake(stakeAmount);

        await time.increase(lockDuration + 1);

        await staking.connect(user).unstake(0);
        await expect(staking.connect(user).unstake(0)).to.be.revertedWithCustomError(staking, "AlreadyClaimed");
    });

    it("should allow emergency withdraw when enabled", async () => {
        await time.increaseTo(await staking.startTime());

        const stakeAmount = parseEther("10");
        await token.connect(user).approve(stakingAddress, stakeAmount);
        await staking.connect(user).stake(stakeAmount);

        await staking.pause();
        await staking.setIsEmergencyWithdraw(true);
        await staking.connect(user).emergencyWithdraw();

        const userStakes = await staking.getUserStakes(user.address);
        expect(userStakes[0].claimed).to.be.true;
    });
});
