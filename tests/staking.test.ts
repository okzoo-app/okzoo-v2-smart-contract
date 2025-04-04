import { expect } from "chai";
import { ethers, network } from "hardhat";
import { ERC20, OkzooV2, OkzooV2__factory, Staking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EIP712Domain, EIP712TypeDefinition } from "../helpers/EIP712.type";
import { signTypedData } from "../helpers/EIP712";
import { parseUnits } from "ethers";

describe("Staking Contract", function () {
    let staking: Staking;
    let stakeToken: ERC20;
    let rewardToken: ERC20;
    let stakingAddress: string;
    let stakeAddress: string;
    let rewardAddress: string;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    const ONE_DAY = 60; // seconds in a day
    const mintAmount = parseUnits("1000000", 18);

    const minStakeAmount = parseUnits("100", 18);
    const maxCap = parseUnits("100000", 18);

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        // Deploy ERC20 token for staking and rewards
        const ERC20Mock = await ethers.getContractFactory("ERC20Token");
        stakeToken = await ERC20Mock.deploy("Stake Token", "STK", mintAmount, owner.address);
        rewardToken = await ERC20Mock.deploy("Reward Token", "RWT", mintAmount, owner.address);

        stakeAddress = await stakeToken.getAddress();
        rewardAddress = await rewardToken.getAddress();

        const startTime = (await time.latest()) + 10;

        const endTime = startTime + 86400; // 1 day in seconds
        const tiers = [
            {
                minStake: parseUnits("10", 18).toString(),
                maxStake: parseUnits("100", 18).toString(),
                baseAPR: parseUnits("140", 0).toString(),
            },
            {
                minStake: parseUnits("100", 18).toString(),
                maxStake: parseUnits("500", 18).toString(),
                baseAPR: parseUnits("180", 0).toString(),
            },
            {
                minStake: parseUnits("500", 18).toString(),
                maxStake: parseUnits("1000", 18).toString(),
                baseAPR: parseUnits("225", 0).toString(),
            },
            {
                minStake: parseUnits("1000", 18).toString(),
                maxStake: parseUnits("5000", 18).toString(),
                baseAPR: parseUnits("295", 0).toString(),
            },
            {
                minStake: parseUnits("5000", 18).toString(),
                maxStake: parseUnits("10000", 18).toString(),
                baseAPR: parseUnits("375", 0).toString(),
            },
            {
                minStake: parseUnits("10000", 18).toString(),
                maxStake: parseUnits("100000", 18).toString(),
                baseAPR: parseUnits("460", 0).toString(),
            },
        ];

        const lockPeriods = [
            {
                daysLocked: parseUnits("7", 0).toString(),
                aprBonus: parseUnits("0", 0).toString(),
            },
            {
                daysLocked: parseUnits("14", 0).toString(),
                aprBonus: parseUnits("5", 0).toString(),
            },
            {
                daysLocked: parseUnits("30", 0).toString(),
                aprBonus: parseUnits("12", 0).toString(),
            },
            {
                daysLocked: parseUnits("90", 0).toString(),
                aprBonus: parseUnits("45", 0).toString(),
            },
            {
                daysLocked: parseUnits("180", 0).toString(),
                aprBonus: parseUnits("100", 0).toString(),
            },
            {
                daysLocked: parseUnits("360", 0).toString(),
                aprBonus: parseUnits("220", 0).toString(),
            },
        ];

        // Deploy the Staking contract
        const Staking = await ethers.getContractFactory("Staking");
        staking = await Staking.deploy();

        stakingAddress = await staking.getAddress();

        // Initialize the Staking contract
        await staking.initialize(
            owner.address,
            stakeAddress,
            rewardAddress,
            startTime, // start time
            endTime, // end time
            maxCap,
            minStakeAmount,
            tiers,
            lockPeriods,
        );

        // Transfer some tokens to the users
        await stakeToken.connect(owner).transfer(user1.address, parseUnits("100000", 18));
        await stakeToken.connect(owner).transfer(user2.address, parseUnits("100000", 18));
        await rewardToken.connect(owner).transfer(stakingAddress, parseUnits("100000", 18));
    });

    describe("Staking", function () {
        beforeEach(async function () {
            // await time.increaseTo((await time.latest()) + 10);
            // Transfer some tokens to the users
            await stakeToken.connect(owner).transfer(user1.address, parseUnits("1000", 18));
            await stakeToken.connect(owner).transfer(user2.address, parseUnits("1000", 18));
            await rewardToken.connect(owner).transfer(stakingAddress, parseUnits("100000", 18));

            // Approve the staking contract to spend the user's tokens
            await stakeToken.connect(user1).approve(stakingAddress, parseUnits("100000", 18));
            await stakeToken.connect(user2).approve(stakingAddress, parseUnits("100000", 18));
        });

        it("should allow a user to stake tokens", async function () {
            const initialStakeAmount = parseUnits("100", 18);
            await staking.connect(user1).stake(initialStakeAmount, 30);

            const stakedAmount = await staking.stakedAmount(user1.address);
            expect(stakedAmount).to.equal(initialStakeAmount);
        });

        it("should revert if the staking amount is less than minStakeAmount", async function () {
            const smallAmount = parseUnits("50", 18);

            const stake = staking.connect(user1).stake(smallAmount, 30);
            await expect(stake).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should revert if total staked exceeds maxCap", async function () {
            await staking.connect(user1).stake(parseUnits("90000", 18), 30);

            const stake = staking.connect(user2).stake(parseUnits("20000", 18), 30);
            await expect(stake).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should revert if the staking period is not valid", async function () {
            const invalidPeriod = 10;

            const stake = staking.connect(user1).stake(parseUnits("100", 18), invalidPeriod);
            await expect(stake).to.be.revertedWithCustomError(staking, "InvalidLockPeriod");
        });

        it("should revert if the staking is paused", async function () {
            await staking.connect(owner).pause();

            const stake = staking.connect(user1).stake(parseUnits("100", 18), 30);
            await expect(stake).to.be.rejectedWith("Pausable: paused");
        });

        // it("should revert if the staking is not started yet", async function () {
        //     const stake = staking.connect(user1).stake(parseUnits("100", 18), 30);
        //     await expect(stake).to.be.revertedWithCustomError(staking, "StakingNotStarted");
        // });

        it("should revert if the staking is ended", async function () {
            await time.increase(86400 * 2); // Fast forward time to after the end time

            const stake = staking.connect(user1).stake(parseUnits("100", 18), 30);
            await expect(stake).to.be.revertedWithCustomError(staking, "NotStakeTime");
        });

        it("should transfer tokens from the user to the contract", async function () {
            // Check initial balances
            const initialStakeAmount = parseUnits("100", 18);
            const lockPeriod = 30; // 30 days
            const userBalanceBefore = await stakeToken.balanceOf(user1.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);

            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            // Check balances after staking
            const userBalanceAfter = await stakeToken.balanceOf(user1.address);
            const contractBalanceAfter = await stakeToken.balanceOf(stakingAddress);

            expect(userBalanceBefore - userBalanceAfter).to.equal(initialStakeAmount);
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(initialStakeAmount);
        });

        it("should generate a unique stake request ID and store the stake request", async function () {
            const initialStakeAmount = parseUnits("100", 18);
            const lockPeriod = 30; // 30 days

            // Trigger the stake
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            const now = (await ethers.provider.getBlock("latest").then((block) => block?.timestamp)) || 0;

            const stakeRequestIds = await staking.getUserStakeRequests(user1.address);

            // Retrieve the stake request from the contract
            const stakeRequest = await staking.stakeRequests(stakeRequestIds[0]);

            const unLockTime = now + lockPeriod * ONE_DAY;

            // Verify the stake request details
            expect(stakeRequest.owner).to.equal(user1.address);
            expect(stakeRequest.amount).to.equal(initialStakeAmount);
            expect(stakeRequest.lockPeriod).to.equal(lockPeriod);
            expect(stakeRequest.unLockTime).to.equal(now + lockPeriod * ONE_DAY);
            expect(stakeRequest.claimed).to.equal(false);
        });

        it("should update the user's staking history", async function () {
            const initialStakeAmount = parseUnits("100", 18);
            const lockPeriod = 30; // 30 days

            // Trigger the stake
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            // Get the user's stake events
            const userStakeEvents = await staking.getUserStakeEvents(user1.address);

            // The first event should be the staking event, the second should be the unlock event
            expect(userStakeEvents[0].amount).to.equal(initialStakeAmount);
            expect(userStakeEvents[0].isStart).to.equal(true);
            expect(userStakeEvents[1].amount).to.equal(initialStakeAmount);
            expect(userStakeEvents[1].isStart).to.equal(false);
        });

        it("should update the user's staked amount and the total staked amount", async function () {
            const initialStakeAmount = parseUnits("100", 18);
            const lockPeriod = 30; // 30 days

            await stakeToken.connect(user1).approve(stakingAddress, initialStakeAmount);

            // Get initial staked amounts
            const userStakedAmountBefore = await staking.stakedAmount(user1.address);
            const totalStakedBefore = await staking.totalStaked();

            // Trigger the stake
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            // Get staked amounts after the stake
            const userStakedAmountAfter = await staking.stakedAmount(user1.address);
            const totalStakedAfter = await staking.totalStaked();

            // Verify that the user's staked amount and total staked amount have been updated
            expect(userStakedAmountAfter - userStakedAmountBefore).to.equal(initialStakeAmount);
            expect(totalStakedAfter - totalStakedBefore).to.equal(initialStakeAmount);
        });
    });

    // describe("Claiming", function () {
    //     it("should allow a user to claim rewards after the lock period ends", async function () {
    //         await stakeToken.connect(user1).approve(staking.address, initialStakeAmount);
    //         await staking.connect(user1).stake(initialStakeAmount, 30); // Assume lock period is 30 days

    //         // Fast forward time to after the lock period
    //         await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    //         await ethers.provider.send("evm_mine");

    //         const balanceBefore = await rewardToken.balanceOf(user1.address);
    //         await staking.connect(user1).claim(1); // Assuming '1' is a valid stakeRequestId

    //         const balanceAfter = await rewardToken.balanceOf(user1.address);
    //         expect(balanceAfter).to.be.gt(balanceBefore);
    //     });

    //     it("should revert if trying to claim before 1/4 of the lock period has passed", async function () {
    //         await stakeToken.connect(user1).approve(staking.address, initialStakeAmount);
    //         await staking.connect(user1).stake(initialStakeAmount, 30);

    //         // Fast forward time to before 1/4 of the lock period has passed
    //         await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
    //         await ethers.provider.send("evm_mine");

    //         await expect(staking.connect(user1).claim(1)).to.be.revertedWith("NotClaimTime");
    //     });
    // });

    // describe("Emergency Withdrawals", function () {
    //     it("should allow emergency withdrawal when enabled", async function () {
    //         await staking.connect(owner).setIsEmergencyWithdraw(true);

    //         await stakeToken.connect(user1).approve(staking.address, initialStakeAmount);
    //         await staking.connect(user1).stake(initialStakeAmount, 30);

    //         // Trigger emergency withdrawal
    //         const balanceBefore = await stakeToken.balanceOf(user1.address);
    //         await staking.connect(user1).emergencyWithdraw();

    //         const balanceAfter = await stakeToken.balanceOf(user1.address);
    //         expect(balanceAfter).to.be.gt(balanceBefore);
    //     });

    //     it("should revert if emergency withdraw is not enabled", async function () {
    //         await stakeToken.connect(user1).approve(staking.address, initialStakeAmount);
    //         await staking.connect(user1).stake(initialStakeAmount, 30);

    //         await expect(staking.connect(user1).emergencyWithdraw()).to.be.revertedWith("NotEmergencyWithdraw");
    //     });
    // });
});
