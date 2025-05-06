import { parseUnits } from "ethers";
import { dateToUnixTimestamp, requireEnv } from "../util";

const config = {
    owner: requireEnv("OWNER_ADDRESS"),
    stakeToken: requireEnv("MAIN_TOKEN_ADDRESS"),
    rewardToken: requireEnv("MAIN_TOKEN_ADDRESS"),

    startTime: dateToUnixTimestamp("2025-05-25 00:00:00 UTC").toString(),
    endTime: dateToUnixTimestamp("2025-05-25 00:00:00 UTC").toString(),

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
