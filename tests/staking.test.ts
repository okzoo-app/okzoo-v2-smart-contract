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

    const initialStakeAmount = parseUnits("100", 18);
    const lockPeriod = 30; // 30 days

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        // Deploy ERC20 token for staking and rewards
        const ERC20Mock = await ethers.getContractFactory("ERC20Token");
        stakeToken = await ERC20Mock.deploy("Stake Token", "STK", mintAmount, owner.address);
        rewardToken = await ERC20Mock.deploy("Reward Token", "RWT", mintAmount, owner.address);

        stakeAddress = await stakeToken.getAddress();
        rewardAddress = await rewardToken.getAddress();

        const startTime = (await time.latest()) - 10;

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
            // Approve the staking contract to spend the user's tokens
            await stakeToken.connect(user1).approve(stakingAddress, parseUnits("100000", 18));
            await stakeToken.connect(user2).approve(stakingAddress, parseUnits("100000", 18));
        });

        it("should allow a user to stake tokens", async function () {
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

        // TODO: Uncomment this test when the staking period is implemented
        // it("should revert if the staking period is not valid", async function () {
        //     const invalidPeriod = 10;

        //     const stake = staking.connect(user1).stake(parseUnits("100", 18), invalidPeriod);
        //     await expect(stake).to.be.revertedWithCustomError(staking, "InvalidLockPeriod");
        // });

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

    describe("Claiming", function () {
        beforeEach(async function () {
            // Approve the staking contract to spend the user's tokens
            await stakeToken.connect(user1).approve(stakingAddress, parseUnits("100000", 18));
            await stakeToken.connect(user2).approve(stakingAddress, parseUnits("100000", 18));
        });

        it("should allow a user to claim rewards after the lock period ends", async function () {
            const balanceBefore = await stakeToken.balanceOf(user1.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);
            const rewardBalanceBefore = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceBefore = await rewardToken.balanceOf(stakingAddress);

            await staking.connect(user1).stake(initialStakeAmount, lockPeriod); // Assume lock period is 30 days
            const stakeRequestIds = await staking.getUserStakeRequests(user1.address);

            // Retrieve the stake request from the contract
            const stakeRequest = await staking.stakeRequests(stakeRequestIds[0]);

            await time.increase(Number(stakeRequest.unLockTime) - (await time.latest()) - 1); // Fast forward time to after the lock period

            await staking.connect(user1).claim(stakeRequestIds[0]);

            const apr = await staking.getAPR(stakeRequest.amount);
            const bonusPeriod = await staking.getBonusPeriod(stakeRequest.lockPeriod);

            // TODO: Double check the reward calculation
            const reward =
                (stakeRequest.amount * (apr + bonusPeriod) * (stakeRequest.unLockTime - stakeRequest.stakeTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);

            const balanceAfter = await stakeToken.balanceOf(user1.address);
            const contractBalanceAfter = await stakeToken.balanceOf(stakingAddress);
            const rewardBalanceAfter = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceAfter = await rewardToken.balanceOf(stakingAddress);

            expect(balanceAfter).to.be.equal(balanceBefore);
            expect(contractBalanceAfter).to.be.equal(contractBalanceBefore);
            expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore + reward);
            expect(rewardContractBalanceAfter).to.be.equal(rewardContractBalanceBefore - reward);
        });

        it("should revert if trying to claim before 1/4 of the lock period has passed", async function () {
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod); // Assume lock period is 30 days
            const stakeRequestIds = await staking.getUserStakeRequests(user1.address);

            // Retrieve the stake request from the contract
            const stakeRequest = await staking.stakeRequests(stakeRequestIds[0]);

            await time.increase((Number(stakeRequest.unLockTime) - Number(stakeRequest.stakeTime)) / 4 - 2); // Fast forward time to after the lock period

            const claim = staking.connect(user1).claim(stakeRequestIds[0]);
            await expect(claim).to.be.revertedWithCustomError(staking, "NotClaimTime");
        });

        it("should allow a user to claim after 1/4 of the lock period has passed, but no has reward", async function () {
            const balanceBefore = await stakeToken.balanceOf(user1.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);
            const rewardBalanceBefore = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceBefore = await rewardToken.balanceOf(stakingAddress);

            await staking.connect(user1).stake(initialStakeAmount, lockPeriod); // Assume lock period is 30 days
            const stakeRequestIds = await staking.getUserStakeRequests(user1.address);

            // Retrieve the stake request from the contract
            const stakeRequest = await staking.stakeRequests(stakeRequestIds[0]);

            await time.increase((Number(stakeRequest.unLockTime) - Number(stakeRequest.stakeTime)) / 4 + 1); // Fast forward time to after the lock period

            await staking.connect(user1).claim(stakeRequestIds[0]);

            const balanceAfter = await stakeToken.balanceOf(user1.address);
            const contractBalanceAfter = await stakeToken.balanceOf(stakingAddress);
            const rewardBalanceAfter = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceAfter = await rewardToken.balanceOf(stakingAddress);

            expect(balanceAfter).to.be.equal(balanceBefore);
            expect(contractBalanceAfter).to.be.equal(contractBalanceBefore);
            expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore);
            expect(rewardContractBalanceAfter).to.be.equal(rewardContractBalanceBefore);
        });

        it("should revert if trying to claim an invalid stake request ID", async function () {
            const invalidStakeRequestId = "0x53a2b5482b6757b5d3377dcdb7150772ddbe731f9bf95a0de349fa6bdd0b4a76";

            const claim = staking.connect(user1).claim(invalidStakeRequestId);
            await expect(claim).to.be.revertedWithCustomError(staking, "NotRequestOwner");
        });

        it("should revert if trying to claim an already claimed stake request", async function () {
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod); // Assume lock period is 30 days
            const stakeRequestIds = await staking.getUserStakeRequests(user1.address);

            // Retrieve the stake request from the contract
            const stakeRequest = await staking.stakeRequests(stakeRequestIds[0]);

            await time.increase(Number(stakeRequest.unLockTime) - (await time.latest()) - 1); // Fast forward time to after the lock period

            await staking.connect(user1).claim(stakeRequestIds[0]);

            const claim = staking.connect(user1).claim(stakeRequestIds[0]);
            await expect(claim).to.be.revertedWithCustomError(staking, "AlreadyClaimed");
        });

        it("calculate reward with multi stake requests should return the correct reward amount", async function () {
            const balanceBefore = await stakeToken.balanceOf(user1.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);
            const rewardBalanceBefore = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceBefore = await rewardToken.balanceOf(stakingAddress);

            await staking.connect(user1).stake(initialStakeAmount, lockPeriod); // Assume lock period is 30 days

            await staking.connect(user1).stake(parseUnits("500", 18), 7);

            await time.increase(ONE_DAY);

            await staking.connect(user1).stake(parseUnits("1000", 18), 14);
            const stakeRequestIds = await staking.getUserStakeRequests(user1.address);

            // Retrieve the stake request from the contract
            const stakeRequest0 = await staking.stakeRequests(stakeRequestIds[0]);
            const stakeRequest1 = await staking.stakeRequests(stakeRequestIds[1]);
            const stakeRequest2 = await staking.stakeRequests(stakeRequestIds[2]);

            const balanceAfter = await stakeToken.balanceOf(user1.address);
            const contractBalanceAfter = await stakeToken.balanceOf(stakingAddress);

            expect(balanceAfter).to.be.equal(
                balanceBefore - stakeRequest0.amount - stakeRequest1.amount - stakeRequest2.amount,
            );
            expect(contractBalanceAfter).to.be.equal(
                contractBalanceBefore + stakeRequest0.amount + stakeRequest1.amount + stakeRequest2.amount,
            );

            await time.increase(Number(stakeRequest0.unLockTime) - (await time.latest()) - 1); // Fast forward time to after the lock period

            console.log({ stakeRequest0, stakeRequest1, stakeRequest2 });

            // calculate the reward for stakeRequest0
            const ranges = [
                {
                    time: stakeRequest0.stakeTime,
                    amount: stakeRequest0.amount,
                    isStart: true,
                },
                {
                    time: stakeRequest1.stakeTime,
                    amount: stakeRequest1.amount,
                    isStart: true,
                },
                {
                    time: stakeRequest2.stakeTime,
                    amount: stakeRequest2.amount,
                    isStart: true,
                },
                {
                    time: stakeRequest1.unLockTime,
                    amount: stakeRequest1.amount,
                    isStart: false,
                },
                {
                    time: stakeRequest2.unLockTime,
                    amount: stakeRequest2.amount,
                    isStart: false,
                },
                {
                    time: stakeRequest0.unLockTime,
                    amount: stakeRequest1.amount,
                    isStart: false,
                },
            ];

            const apr0 = await staking.getAPR(stakeRequest0.amount);
            const apr1 = await staking.getAPR(stakeRequest0.amount + stakeRequest1.amount);
            const apr2 = await staking.getAPR(stakeRequest0.amount + stakeRequest1.amount + stakeRequest2.amount);
            const apr3 = await staking.getAPR(
                stakeRequest0.amount + stakeRequest1.amount + stakeRequest2.amount - stakeRequest1.amount,
            );
            const apr4 = await staking.getAPR(
                stakeRequest0.amount +
                    stakeRequest1.amount +
                    stakeRequest2.amount -
                    stakeRequest1.amount -
                    stakeRequest2.amount,
            );

            const bonusPeriod0 = await staking.getBonusPeriod(stakeRequest0.lockPeriod);

            const reward0 =
                (stakeRequest0.amount * (apr0 + bonusPeriod0) * (stakeRequest1.stakeTime - stakeRequest0.stakeTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);
            const reward1 =
                (stakeRequest0.amount * (apr1 + bonusPeriod0) * (stakeRequest2.stakeTime - stakeRequest1.stakeTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);
            const reward2 =
                (stakeRequest0.amount * (apr2 + bonusPeriod0) * (stakeRequest1.unLockTime - stakeRequest2.stakeTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);
            const reward3 =
                (stakeRequest0.amount * (apr3 + bonusPeriod0) * (stakeRequest2.unLockTime - stakeRequest1.unLockTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);
            const reward4 =
                (stakeRequest0.amount * (apr4 + bonusPeriod0) * (stakeRequest0.unLockTime - stakeRequest2.unLockTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);

            const totalReward = reward0 + reward1 + reward2 + reward3 + reward4;
            // console.log({ totalReward });

            // const sRanges = await staking.getUserStakeEvents(user1.address);
            // console.log({ sRanges });

            // const sortedRanges = await staking.getEvents(user1.address);
            // console.log({ sortedRanges });

            // console.log({ ranges });

            await staking.connect(user1).claim(stakeRequestIds[0]);
            const rewardBalanceAfter = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceAfter = await rewardToken.balanceOf(stakingAddress);

            // const sReward = await staking.getReward(stakeRequestIds[0]);
            // console.log({ sReward });
            // expect(sReward).to.be.equal(totalReward);

            expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore + totalReward);
            expect(rewardContractBalanceAfter).to.be.equal(rewardContractBalanceBefore - totalReward);
        });
    });

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
