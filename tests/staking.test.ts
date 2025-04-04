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

        const startTime = 0;
        const endTime = 10000000000000;
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
