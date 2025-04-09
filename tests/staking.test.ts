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
    const ONE_DAY = 60n; // seconds in a day
    const mintAmount = parseUnits("1000000", 18);

    const minStakeAmount = parseUnits("10", 18);
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

            const stakedAmount = await staking.stakingAmount(user1.address);
            expect(stakedAmount).to.equal(initialStakeAmount);
        });

        it("should revert if the staking amount is less than minStakeAmount", async function () {
            const smallAmount = parseUnits("1", 18);

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

            // Verify the stake request details
            expect(stakeRequest.owner).to.equal(user1.address);
            expect(stakeRequest.amount).to.equal(initialStakeAmount);
            expect(stakeRequest.lockPeriod).to.equal(lockPeriod);
            expect(stakeRequest.claimed).to.equal(false);
        });

        it("should update the user's staking history", async function () {
            // Trigger the stake
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            // Get the user's stake events
            const userStakeEvents = await staking.getUserEvents(user1.address);

            // The first event should be the staking event, the second should be the unlock event
            expect(userStakeEvents[0].amount).to.equal(initialStakeAmount);
            expect(userStakeEvents[0].isStake).to.equal(true);
        });

        it("should update the user's staked amount and the total staked amount", async function () {
            await stakeToken.connect(user1).approve(stakingAddress, initialStakeAmount);

            // Get initial staked amounts
            const userStakedAmountBefore = await staking.stakingAmount(user1.address);
            const totalStakedBefore = await staking.totalStaked();

            // Trigger the stake
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            // Get staked amounts after the stake
            const userStakedAmountAfter = await staking.stakingAmount(user1.address);
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

            await time.increase(Number(stakeRequest.lockPeriod * ONE_DAY) + 100000); // Fast forward time to after the lock period

            await staking.connect(user1).claim(stakeRequestIds[0]);

            const apr = await staking.getAPR(stakeRequest.amount);
            const bonusPeriod = await staking.getBonusPeriod(stakeRequest.lockPeriod);

            // TODO: Double check the reward calculation
            const reward =
                (stakeRequest.amount * (apr + bonusPeriod) * (stakeRequest.lockPeriod * ONE_DAY)) /
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

            await time.increase(Number(stakeRequest.lockPeriod * ONE_DAY) / 4 - 2); // Fast forward time to after the lock period

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

            await time.increase(Number(stakeRequest.lockPeriod * ONE_DAY) / 4 + 1); // Fast forward time to after the lock period

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

            await time.increase(Number(stakeRequest.lockPeriod * ONE_DAY)); // Fast forward time to after the lock period

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

            await time.increase(Number(stakeRequest0.lockPeriod * ONE_DAY)); // Fast forward time to after the lock period

            const now = await time.latest();

            // calculate the reward for stakeRequest0
            const ranges = [
                {
                    time: stakeRequest0.stakeTime,
                    amount: stakeRequest0.amount,
                    isStake: true,
                },
                {
                    time: stakeRequest1.stakeTime,
                    amount: stakeRequest1.amount,
                    isStake: true,
                },
                {
                    time: stakeRequest2.stakeTime,
                    amount: stakeRequest2.amount,
                    isStake: true,
                },
                {
                    time: now,
                    amount: stakeRequest0.amount,
                    isStake: false,
                },
            ];

            const apr0 = await staking.getAPR(stakeRequest0.amount);
            const apr1 = await staking.getAPR(stakeRequest0.amount + stakeRequest1.amount);
            const apr2 = await staking.getAPR(stakeRequest0.amount + stakeRequest1.amount + stakeRequest2.amount);

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
                (stakeRequest0.amount *
                    (apr2 + bonusPeriod0) *
                    (stakeRequest0.stakeTime + stakeRequest0.lockPeriod * ONE_DAY - stakeRequest2.stakeTime)) /
                100n /
                365n /
                BigInt(ONE_DAY);

            const totalReward = reward0 + reward1 + reward2;

            await staking.connect(user1).claim(stakeRequestIds[0]);
            const rewardBalanceAfter = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceAfter = await rewardToken.balanceOf(stakingAddress);

            expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore + totalReward);
            expect(rewardContractBalanceAfter).to.be.equal(rewardContractBalanceBefore - totalReward);
        });

        it("calculate reward with multi stake requests should return the correct reward amount with different lock periods", async function () {
            const balanceBefore = await stakeToken.balanceOf(user1.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);
            const rewardBalanceBefore = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceBefore = await rewardToken.balanceOf(stakingAddress);

            await staking.connect(user1).stake(parseUnits("85", 18), 90);

            await time.increase(15 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("10000", 18), 7);

            await time.increase(9 * Number(ONE_DAY));
            const now0 = await time.latest();
            const stakeRequestIds0 = await staking.getUserStakeRequests(user1.address);
            const stakeRequest01 = await staking.stakeRequests(stakeRequestIds0[0]);
            const stakeRequest02 = await staking.stakeRequests(stakeRequestIds0[1]);
            const ranges0 = [
                {
                    time: stakeRequest01.stakeTime,
                    amount: stakeRequest01.amount,
                    isStake: true,
                },
                {
                    time: stakeRequest02.stakeTime,
                    amount: stakeRequest02.amount,
                    isStake: true,
                },
                {
                    time: now0,
                    amount: stakeRequest02.amount,
                    isStake: false,
                },
            ];

            const apr01 = await staking.getAPR(stakeRequest01.amount + stakeRequest02.amount);
            const bonusPeriod01 = await staking.getBonusPeriod(stakeRequest02.lockPeriod);

            const reward0 =
                (stakeRequest02.amount * (apr01 + bonusPeriod01) * (stakeRequest02.lockPeriod * ONE_DAY)) /
                100n /
                365n /
                BigInt(ONE_DAY);

            console.log({ reward0 });
            const rewardBalanceBefore0 = await rewardToken.balanceOf(user1.address);
            await staking.connect(user1).claim(stakeRequestIds0[1]); // 10000
            const rewardBalanceAfter0 = await rewardToken.balanceOf(user1.address);
            expect(rewardBalanceAfter0).to.be.equal(rewardBalanceBefore0 + reward0);

            await time.increase(6 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("1000", 18), 30);

            await time.increase(10 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("4500", 18), 360);

            await time.increase(Number(ONE_DAY));
            const now1 = await time.latest();
            const stakeRequestIds1 = await staking.getUserStakeRequests(user1.address);

            const stakeRequest11 = await staking.stakeRequests(stakeRequestIds1[1]);

            console.log({ stakeRequest11 });
            // 85: 0, 1000: 1, 4500: 2

            const rewardBalanceBefore1 = await rewardToken.balanceOf(user1.address);
            await staking.connect(user1).claim(stakeRequestIds1[1]); // 1000
            const rewardBalanceAfter1 = await rewardToken.balanceOf(user1.address);
            expect(rewardBalanceAfter1).to.be.equal(rewardBalanceBefore1); // no reward yet, because not enough time passed

            await time.increase(4 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("2500", 18), 14);

            await time.increase(2 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("100", 18), 30);

            await time.increase(16 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("2900", 18), 14);

            await time.increase(2 * Number(ONE_DAY));
            const stakeRequestIds2 = await staking.getUserStakeRequests(user1.address);
            const stakeRequest202 = await staking.stakeRequests(stakeRequestIds2[2]);
            console.log("========");

            console.log({ stakeRequest202 });

            const rewardBalanceBefore2 = await rewardToken.balanceOf(user1.address);
            const reward2 = 364383561643835616437n;
            console.log({ reward2 });
            await staking.connect(user1).claim(stakeRequestIds2[2]); // 2500
            const rewardBalanceAfter2 = await rewardToken.balanceOf(user1.address);
            expect(rewardBalanceAfter2).to.be.equal(rewardBalanceBefore2 + reward2);

            await time.increase(5 * Number(ONE_DAY));
            await staking.connect(user1).stake(parseUnits("500", 18), 7);

            await time.increase(1 * Number(ONE_DAY));
            const stakeRequestId3 = await staking.getUserStakeRequests(user1.address);
            const stakeRequest33 = await staking.stakeRequests(stakeRequestId3[3]);
            console.log("========");
            console.log({ stakeRequest33 });

            const rewardBalanceBefore3 = await rewardToken.balanceOf(user1.address);
            const reward3 = 0n;
            console.log({ reward3 });

            await staking.connect(user1).claim(stakeRequestId3[3]); // 100
            const rewardBalanceAfter3 = await rewardToken.balanceOf(user1.address);
            expect(rewardBalanceAfter3).to.be.equal(rewardBalanceBefore3 + reward3);

            await time.increase(24 * Number(ONE_DAY));
            const stakeRequestId4 = await staking.getUserStakeRequests(user1.address);
            const stakeRequest40 = await staking.stakeRequests(stakeRequestId4[0]);
            console.log({ stakeRequest40 });

            const rewardBalanceBefore4 = await rewardToken.balanceOf(user1.address);
            const reward4 = 76086255707762557073n;
            console.log({ rewardBalanceBefore4, reward4 });

            await staking.connect(user1).claim(stakeRequestId4[0]); // 85
            const rewardBalanceAfter4 = await rewardToken.balanceOf(user1.address);
            console.log({ rewardBalanceAfter4 });
            expect(rewardBalanceAfter4).to.be.equal(rewardBalanceBefore4 + reward4);

            await time.increase(20 * Number(ONE_DAY));
            const stakeRequestId5 = await staking.getUserStakeRequests(user1.address);
            console.log({ stakeRequestId5 });
            const stakeRequest52 = await staking.stakeRequests(stakeRequestId5[2]);
            console.log({ stakeRequest52 });

            const rewardBalanceBefore5 = await rewardToken.balanceOf(user1.address);
            const reward5 = 436304337899543378994n;
            console.log({ rewardBalanceBefore5, reward5 });

            await staking.connect(user1).claim(stakeRequestId5[2]); // 2900
            const rewardBalanceAfter5 = await rewardToken.balanceOf(user1.address);
            console.log({ rewardBalanceAfter5 });
            expect(rewardBalanceAfter5).to.be.equal(rewardBalanceBefore5 + reward5);

            await time.increase(285 * Number(ONE_DAY));
            const stakeRequestId6 = await staking.getUserStakeRequests(user1.address);
            const stakeRequest60 = await staking.stakeRequests(stakeRequestId6[0]);
            const stakeRequest61 = await staking.stakeRequests(stakeRequestId6[1]);
            console.log({ stakeRequest60, stakeRequest61 });

            const rewardBalanceBefore6 = await rewardToken.balanceOf(user1.address);
            const reward6 = 26389736301369863013694n;
            console.log({ rewardBalanceBefore6, reward6 });

            await staking.connect(user1).claim(stakeRequestId6[1]); // 4500
            const rewardBalanceAfter6 = await rewardToken.balanceOf(user1.address);
            console.log({ rewardBalanceAfter6 });
            expect(rewardBalanceAfter6).to.be.equal(rewardBalanceBefore6 + reward6);

            // 4500 * (375 + 220) * 360 / 100 / 365

            const rewardBalanceBefore7 = await rewardToken.balanceOf(user1.address);
            const reward7 = 35958904109589041095n;
            console.log({ rewardBalanceBefore7, reward7 });

            await staking.connect(user1).claim(stakeRequestId6[0]);
            const rewardBalanceAfter7 = await rewardToken.balanceOf(user1.address);
            console.log({ rewardBalanceAfter7 });
            expect(rewardBalanceAfter7).to.be.equal(rewardBalanceBefore7 + reward7);

            const totalReward = 28184661141552511415512n;

            const rewardBalanceAfterEnd = await rewardToken.balanceOf(user1.address);
            const rewardContractBalanceAfterEnd = await rewardToken.balanceOf(stakingAddress);
            expect(rewardBalanceAfterEnd).to.be.equal(rewardBalanceBefore + totalReward);
            expect(rewardContractBalanceAfterEnd).to.be.equal(rewardContractBalanceBefore - totalReward);
        });
    });

    describe("Emergency Withdrawals", function () {
        beforeEach(async function () {
            // Approve the staking contract to spend the user's tokens
            await stakeToken.connect(user1).approve(stakingAddress, parseUnits("100000", 18));
            await stakeToken.connect(user2).approve(stakingAddress, parseUnits("100000", 18));
        });
        it("should allow emergency withdrawal when enabled", async function () {
            const balanceBefore = await stakeToken.balanceOf(user1.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);

            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);
            await staking.connect(user1).stake(parseUnits("500", 18), 7);
            await staking.connect(user1).stake(parseUnits("1000", 18), 14);

            await staking.connect(owner).pause();
            await staking.connect(owner).setIsEmergencyWithdraw(true);

            // Trigger emergency withdrawal
            await staking.connect(user1).emergencyWithdraw();

            const balanceAfter = await stakeToken.balanceOf(user1.address);
            const contractBalanceAfter = await stakeToken.balanceOf(stakingAddress);
            expect(balanceAfter).to.be.equal(balanceBefore);
            expect(contractBalanceAfter).to.be.equal(contractBalanceBefore);
        });

        it("should revert if emergency withdraw is not enabled", async function () {
            await staking.connect(user1).stake(initialStakeAmount, 30);

            await expect(staking.connect(user1).emergencyWithdraw()).to.be.rejectedWith("Pausable: not paused");
        });

        it("should revert if the user has no staked tokens", async function () {
            await staking.connect(owner).pause();
            await staking.connect(owner).setIsEmergencyWithdraw(true);

            await expect(staking.connect(user1).emergencyWithdraw()).to.be.revertedWithCustomError(
                staking,
                "InsufficientStakedAmount",
            );
        });

        it("should allow owner to withdraw tokens", async function () {
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            const balanceBefore = await stakeToken.balanceOf(owner.address);
            const contractBalanceBefore = await stakeToken.balanceOf(stakingAddress);

            await staking.connect(owner).withdraw(stakeAddress, owner.address, initialStakeAmount);

            const balanceAfter = await stakeToken.balanceOf(owner.address);
            const contractBalanceAfter = await stakeToken.balanceOf(stakingAddress);
            expect(balanceAfter).to.be.equal(balanceBefore + initialStakeAmount);
            expect(contractBalanceAfter).to.be.equal(contractBalanceBefore - initialStakeAmount);
        });

        it("should revert if the owner tries to withdraw more than the contract balance", async function () {
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);

            const withdraw = staking.connect(owner).withdraw(stakeAddress, owner.address, mintAmount);
            await expect(withdraw).to.be.rejectedWith("ERC20: transfer amount exceeds balance");
        });

        it("should revert if a non-owner tries to withdraw tokens", async function () {
            await staking.connect(user1).stake(initialStakeAmount, lockPeriod);
            const withdraw = staking.connect(user1).withdraw(stakeAddress, user1.address, initialStakeAmount);
            await expect(withdraw).to.be.rejectedWith("Ownable: caller is not the owner");
        });
    });
});
