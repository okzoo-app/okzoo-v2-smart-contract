import { parseUnits } from "ethers";

const config = {
    owner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313", // TODO: set owner
    stakeToken: "0x5fCb38F6bB84E029c9Ed5a9dF297979b92B34970",
    rewardToken: "0x5fCb38F6bB84E029c9Ed5a9dF297979b92B34970",
    maxCap: parseUnits("100000", 18).toString(),
    minStakeAmount: parseUnits("10", 18).toString(),
    tiers: [
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
    ],
    lockPeriods: [
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
    ],
};

export default config;
