import { parseUnits } from "ethers";

const config = {
    owner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313", // TODO: set owner
    stakeToken: "0x5fCb38F6bB84E029c9Ed5a9dF297979b92B34970",
    rewardToken: "0x5fCb38F6bB84E029c9Ed5a9dF297979b92B34970",
    startTime: parseUnits("1745378761", 0).toString(),
    endTime: parseUnits("1745824889", 0).toString(),
    maxCap: parseUnits("100000000", 18).toString(),
    minStakeAmount: parseUnits("1000", 18).toString(),
    tiers: [
        {
            minStake: parseUnits("1000", 18).toString(),
            maxStake: parseUnits("10000", 18).toString(),
            baseAPR: parseUnits("140", 0).toString(),
        },
        {
            minStake: parseUnits("10000", 18).toString(),
            maxStake: parseUnits("50000", 18).toString(),
            baseAPR: parseUnits("180", 0).toString(),
        },
        {
            minStake: parseUnits("50000", 18).toString(),
            maxStake: parseUnits("100000", 18).toString(),
            baseAPR: parseUnits("225", 0).toString(),
        },
        {
            minStake: parseUnits("100000", 18).toString(),
            maxStake: parseUnits("500000", 18).toString(),
            baseAPR: parseUnits("295", 0).toString(),
        },
        {
            minStake: parseUnits("500000", 18).toString(),
            maxStake: parseUnits("1000000", 18).toString(),
            baseAPR: parseUnits("375", 0).toString(),
        },
        {
            minStake: parseUnits("1000000", 18).toString(),
            maxStake: parseUnits("100000000", 18).toString(),
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
