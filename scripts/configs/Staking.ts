import { parseUnits } from "ethers";
import { dateToUnixTimestamp, requireEnv } from "../util";

const config = {
    owner: requireEnv("OWNER_ADDRESS"),
    stakeToken: requireEnv("MAIN_TOKEN_ADDRESS"),
    rewardToken: requireEnv("MAIN_TOKEN_ADDRESS"),

    startTime: dateToUnixTimestamp(requireEnv("STAKING_START_TIME")).toString(),
    endTime: dateToUnixTimestamp(requireEnv("STAKING_END_TIME")).toString(),

    maxCap: parseUnits("30000000", 18).toString(),
    minStakeAmount: parseUnits("100", 18).toString(),
    tiers: [
        {
            minStake: parseUnits("100", 18).toString(),
            maxStake: parseUnits("1000", 18).toString(),
            baseAPR: parseUnits("100", 0).toString(),
        },
        {
            minStake: parseUnits("1000", 18).toString(),
            maxStake: parseUnits("5000", 18).toString(),
            baseAPR: parseUnits("140", 0).toString(),
        },
        {
            minStake: parseUnits("5000", 18).toString(),
            maxStake: parseUnits("10000", 18).toString(),
            baseAPR: parseUnits("190", 0).toString(),
        },
        {
            minStake: parseUnits("10000", 18).toString(),
            maxStake: parseUnits("50000", 18).toString(),
            baseAPR: parseUnits("240", 0).toString(),
        },
        {
            minStake: parseUnits("50000", 18).toString(),
            maxStake: parseUnits("100000", 18).toString(),
            baseAPR: parseUnits("275", 0).toString(),
        },
        {
            minStake: parseUnits("100000", 18).toString(),
            maxStake: parseUnits("30000000", 18).toString(),
            baseAPR: parseUnits("300", 0).toString(),
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
